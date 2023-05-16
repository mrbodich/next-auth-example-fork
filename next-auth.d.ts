import "next-auth/jwt"

// Read more at: https://next-auth.js.org/getting-started/typescript#module-augmentation

declare module "next-auth/jwt" {
  interface JWT {
    access_token: string
    refresh_token: string
    id_token: string
    expires_at: number
    provider: string
    error?: "RefreshAccessTokenError"
    /** The user's role. */
    userRole?: "admin"
  }
}

declare module "next-auth" {
  interface Session extends Session {
      error?: "RefreshAccessTokenError"
  }

  interface KeycloakTokenSet {
      access_token: string
      refresh_token: string
      id_token: string
      expires_in: number
      refresh_expires_in: number
  }
}