import React, { Component } from 'react'
import { Mutation } from 'react-apollo'
import PropTypes from 'prop-types'
import gql from 'graphql-tag'
import Router from 'next/router'
import Form from './styles/Form'
import Error from './ErrorMessage'
import { CURRENT_USER_QUERY } from './User'

const RESET_MUTATION = gql`
  mutation RESET_MUTATION(
    $resetToken: String!
    $password: String!
    $confirmPassword: String!
  ) {
    resetPassword(
      resetToken: $resetToken
      password: $password
      confirmPassword: $confirmPassword
    ) {
      id
      email
      name
    }
  }
`
class Reset extends Component {
  static propTypes = {
    resetToken: PropTypes.string.isRequired,
  }
  state = {
    password: '',
    confirmPassword: '',
  }

  saveToState = e => {
    this.setState({ [e.target.name]: e.target.value })
  }
  render() {
    return (
      <Mutation
        mutation={RESET_MUTATION}
        variables={{
          resetToken: this.props.resetToken,
          password: this.state.password,
          confirmPassword: this.state.confirmPassword,
        }}
        refetchQueries={[{ query: CURRENT_USER_QUERY }]}
      >
        {(resetPassword, { loading, error, called }) => (
          <Form
            method='post'
            onSubmit={async e => {
              // Stop form from submitting
              e.preventDefault()
              // Call the mutation
              const res = await resetPassword()

              this.setState({
                password: '',
                confirmPassword: '',
              })
              // Change to item page
              Router.push({
                pathname: '/items',
              })
              console.log(res)
            }}
          >
            <fieldset disabled={loading} aria-busy={loading}>
              <h2>Reset your password</h2>
              <Error error={error} />
              <label htmlFor='password'>
                Password
                <input
                  type='password'
                  name='password'
                  placeholder='password'
                  value={this.state.password}
                  onChange={this.saveToState}
                ></input>
              </label>
              <label htmlFor='confirmPassword'>
                Confirm Password
                <input
                  type='password'
                  name='confirmPassword'
                  placeholder='confirmPassword'
                  value={this.state.confirmPassword}
                  onChange={this.saveToState}
                ></input>
              </label>
              <button type='submit'>Reset!</button>
            </fieldset>
          </Form>
        )}
      </Mutation>
    )
  }
}

export default Reset
