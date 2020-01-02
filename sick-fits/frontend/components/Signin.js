import React, { Component } from 'react'
import { Mutation } from 'react-apollo'
import gql from 'graphql-tag'
import Form from './styles/Form'
import Error from './ErrorMessage'
import { CURRENT_USER_QUERY } from './User'

const SIGNIN_MUTATION = gql`
  mutation SIGNIN_MUTATION($email: String!, $password: String!) {
    signin(email: $email, password: $password) {
      id
      email
      name
    }
  }
`
class Signin extends Component {
  state = {
    email: 'test@testy.com',
    password: 'test',
  }

  saveToState = e => {
    this.setState({ [e.target.name]: e.target.value })
  }
  render() {
    return (
      <Mutation
        mutation={SIGNIN_MUTATION}
        variables={this.state}
        refetchQueries={[{ query: CURRENT_USER_QUERY }]}
      >
        {(signin, { loading, error }) => (
          <Form
            method='post'
            onSubmit={async e => {
              // Stop form from submitting
              e.preventDefault()
              // Call the mutation
              const res = await signin()

              this.setState({
                email: '',
                password: '',
              })
              console.log(res)
            }}
          >
            <fieldset disabled={loading} aria-busy={loading}>
              <h2>Sign into your account</h2>
              <Error error={error} />
              <label htmlFor='email'>
                Email{' '}
                <input
                  type='email'
                  name='email'
                  placeholder='email'
                  value={this.state.email}
                  onChange={this.saveToState}
                ></input>
              </label>
              <label htmlFor='password'>
                Password{' '}
                <input
                  type='password'
                  name='password'
                  placeholder='password'
                  value={this.state.password}
                  onChange={this.saveToState}
                ></input>
              </label>
              <button type='submit'>Sign in</button>
            </fieldset>
          </Form>
        )}
      </Mutation>
    )
  }
}

export default Signin
