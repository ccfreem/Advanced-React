import React, { Component } from 'react'
import { Mutation } from 'react-apollo'
import gql from 'graphql-tag'
import Form from './styles/Form'
import Error from './ErrorMessage'
import { CURRENT_USER_QUERY } from './User'

const SIGNUP_MUTATION = gql`
  mutation SIGNUP_MUTATION(
    $name: String!
    $email: String!
    $password: String!
  ) {
    signup(name: $name, email: $email, password: $password) {
      id
      email
      name
    }
  }
`
class Signup extends Component {
  state = {
    name: '',
    email: '',
    password: '',
  }

  saveToState = e => {
    this.setState({ [e.target.name]: e.target.value })
  }
  render() {
    return (
      <Mutation
        mutation={SIGNUP_MUTATION}
        variables={this.state}
        refetchQueries={[{ query: CURRENT_USER_QUERY }]}
      >
        {(signup, { loading, error }) => (
          <Form
            method='post'
            onSubmit={async e => {
              // Stop form from submitting
              e.preventDefault()
              // Call the mutation
              const res = await signup()

              this.setState({
                email: '',
                name: '',
                password: '',
              })
            }}
          >
            <fieldset disabled={loading} aria-busy={loading}>
              <h2>Sign up for an account</h2>
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
              <label htmlFor='name'>
                Name{' '}
                <input
                  type='text'
                  name='name'
                  placeholder='name'
                  value={this.state.name}
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
              <button type='submit'>Sign up</button>
            </fieldset>
          </Form>
        )}
      </Mutation>
    )
  }
}

export default Signup
export { SIGNUP_MUTATION }
