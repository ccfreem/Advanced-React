const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { randomBytes } = require('crypto')
const { promisify } = require('util')
const { transport, makeANiceEmail } = require('../mail')
const { hasPermission } = require('../utils')
const stripe = require('../stripe')

const Mutations = {
  async createItem(parent, args, ctx, info) {
    // TODO: check if logged in
    if (!ctx.request.userId) {
      throw new Error(`You must be logged in!`)
    }
    const item = await ctx.db.mutation.createItem(
      {
        data: {
          // This is how we create a relationship between item and user
          user: {
            connect: {
              id: ctx.request.userId,
            },
          },
          ...args,
        },
      },
      info
    )
    return item
  },

  updateItem(parent, args, ctx, info) {
    // first take a copy of updates
    const updates = { ...args }
    // remove the id of the updates
    delete updates.id
    // run the update method
    return ctx.db.mutation.updateItem(
      {
        data: updates,
        where: {
          id: args.id,
        },
      },
      info
    )
  },
  async deleteItem(parent, args, ctx, info) {
    const where = { id: args.id }
    // 1. find the item
    const item = await ctx.db.query.item({ where }, `{id title user{id}}`)
    // 2. check if they own or have permissions
    //TODO
    const ownsItem = item.user.id === ctx.request.userId
    const hasPermissions = ctx.request.user.permissions.some(permission =>
      ['ADMIN', 'ITEMDELET'].includes(permission)
    )
    if (!ownsItem && !hasPermissions) {
      throw new Error('You cannot do that')
    }
    // 3. delete it!
    return ctx.db.mutation.deleteItem({ where }, info)
  },
  async signup(parent, args, ctx, info) {
    args.email = args.email.toLowerCase()
    // hash password with salt
    const password = await bcrypt.hash(args.password, 10)
    // create the user in the db
    const user = await ctx.db.mutation.createUser(
      {
        data: {
          ...args,
          password,
          permissions: { set: ['USER', 'ADMIN'] },
        },
      },
      info
    )
    // create the JWT token for them
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET)
    // set the jwt as a cookie on the response
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year cookie
    })
    // return the user to the browser
    return user
  },
  async signin(parent, { email, password }, ctx, info) {
    // check if there is a user with that email
    const user = await ctx.db.query.user({ where: { email } })
    if (!user) {
      throw new Error(`No such user found for email: ${email}`)
    }
    // check if their password is correct
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      throw new Error('Invalid password!')
    }
    // create jwt
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET)
    // set the cookie with jwt
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year cookie
    })
    // return user
    return user
  },
  signout(parent, args, ctx, info) {
    ctx.response.clearCookie('token')
    return { message: 'Goodbye!' }
  },
  async requestReset(parent, args, ctx, info) {
    // check if real user
    const user = await ctx.db.query.user({ where: { email: args.email } })
    if (!user) {
      throw new Error(`No such user found for email: ${args.email}`)
    }
    // set a reset token and expiry
    const randomBytesPromisified = promisify(randomBytes)
    const resetToken = (await randomBytesPromisified(20)).toString('hex')
    const resetTokenExpiry = Date.now() + 3600000
    const res = await ctx.db.mutation.updateUser({
      where: { email: args.email },
      data: { resetToken, resetTokenExpiry },
    })
    // email the reset
    const mailRes = await transport.sendMail({
      from: 'wes@wesbos.com',
      to: user.email,
      subject: 'Your Password Reset Token',
      html: makeANiceEmail(`Your Password Reset Token is here!
      \n\n
      <a href="${process.env.FRONTEND_URL}/reset?resetToken=${resetToken}">Click Here to Reset</a>`),
    })

    return { message: 'thanks' }
  },
  async resetPassword(parent, args, ctx, info) {
    const { password, confirmPassword, resetToken } = args
    // check if passwords match
    const passwordsMatch = password === confirmPassword
    if (!passwordsMatch) {
      throw new Error(`Passwords don't match!`)
    }
    // check if its a legit reset token
    const [user] = await ctx.db.query.users({
      where: {
        resetToken,
        resetTokenExpiry_gte: Date.now() - 3600000,
      },
    })
    // check if its expired
    if (!user) {
      throw new Error(`This token is either invalid or expired`)
    }
    // hash their new password
    const newPassword = await bcrypt.hash(password, 10)
    // save the new password to the user and remove old resettoken
    const updatedUser = await ctx.db.mutation.updateUser({
      where: { email: user.email },
      data: {
        password: newPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    })
    // generate jwt
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET)
    // set the jwt
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year cookie
    })
    // return the new user
    return updatedUser
  },
  async updatePermissions(parent, args, ctx, info) {
    // 1. Check if they are logged in
    if (!ctx.request.userId) {
      throw new Error('You must be logged in!')
    }
    // 2. Query the current user
    const currentUser = await ctx.db.query.user(
      {
        where: {
          id: ctx.request.userId,
        },
      },
      info
    )
    // 3. Check if they have permissions to do this
    hasPermission(currentUser, ['ADMIN', 'PERMISSIONUPDATE'])
    // 4. Update the permissions
    return ctx.db.mutation.updateUser(
      {
        data: {
          permissions: {
            set: args.permissions,
          },
        },
        where: {
          id: args.userId,
        },
      },
      info
    )
  },
  async addToCart(parent, args, ctx, info) {
    // make suer they are signed in
    const { userId } = ctx.request
    if (!userId) {
      throw new Error('You must be signed in to add to cart!')
    }
    // query the users' current cart
    const [existingCartItem] = await ctx.db.query.cartItems({
      where: {
        user: { id: userId },
        item: { id: args.id },
      },
    })
    // check if that item is in cart, increment by 1 if it is
    if (existingCartItem) {
      console.log('this item is already in cart')
      return ctx.db.mutation.updateCartItem(
        {
          where: { id: existingCartItem.id },
          data: { quantity: existingCartItem.quantity + 1 },
        },
        info
      )
    }
    // create a fresh cart item if not
    return ctx.db.mutation.createCartItem(
      {
        data: {
          user: {
            connect: { id: userId },
          },
          item: {
            connect: { id: args.id },
          },
        },
      },
      info
    )
  },
  async removeFromCart(parent, args, ctx, info) {
    // find cart item
    // make sure they own that cart item
    const cartItem = await ctx.db.query.cartItem(
      {
        where: {
          id: args.id,
        },
      },
      `{id, user {id}}`
    )

    if (!cartItem) throw new Error('No cart item found')
    if (cartItem.user.id !== ctx.request.userId) {
      throw new Error('Not yours to delete!')
    }

    // delete that cart item
    return ctx.db.mutation.deleteCartItem({
      where: {
        id: args.id,
      },
      info,
    })
  },
  async createOrder(parent, args, ctx, info) {
    console.log('started')
    // query current user
    const { userId } = ctx.request
    if (!userId) {
      throw new Error('You must be signed in to add to cart!')
    }
    const user = await ctx.db.query.user(
      { where: { id: userId } },
      `{id
       name
       email 
       cart 
        {
          id 
          quantity 
          item 
          {
            title
            price
            id
            description
            image
            largeImage
          }
        }}`
    )
    // recalculate the total for the price
    const amount = user.cart.reduce(
      (tally, cartItem) => tally + cartItem.item.price * cartItem.quantity,
      0
    )

    // create the stripe charge
    const charge = await stripe.charges.create({
      amount,
      currency: 'USD',
      source: args.token,
    })

    // convert the cart items to order items
    const orderItems = user.cart.map(cartItem => {
      const orderItem = {
        ...cartItem.item,
        quantity: cartItem.quantity,
        user: { connect: { id: userId } },
      }
      delete orderItem.id
      return orderItem
    })
    // create the order
    const order = await ctx.db.mutation.createOrder({
      data: {
        total: charge.amount,
        charge: charge.id,
        items: { create: orderItems },
        user: { connect: { id: userId } },
      },
    })
    // clean up - clear the cart, delete cartitems
    const cartItemIds = user.cart.map(cartItem => cartItem.id)
    await ctx.db.mutation.deleteManyCartItems({
      where: {
        id_in: cartItemIds,
      },
    })
    // return the order to the client
    return order
  },
}

module.exports = Mutations
