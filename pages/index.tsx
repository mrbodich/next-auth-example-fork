import Layout from "../components/layout"
import { GetServerSideProps } from "next"
import { getSession } from "next-auth/react"

export default function IndexPage() {
  return (
    <Layout>
      <h1>NextAuth.js Example</h1>
      <p>
        This is an example site to demonstrate how to use{" "}
        <a href="https://next-auth.js.org">NextAuth.js</a> for authentication.
      </p>
    </Layout>
  )
}

//Token is not persisting when using server side session
export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context)
  return {
      props: {
          session
      }
  }
}
