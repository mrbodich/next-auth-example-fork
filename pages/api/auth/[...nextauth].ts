import NextAuth, { KeycloakTokenSet, NextAuthOptions, TokenSet } from "next-auth"
import KeycloakProvider, { KeycloakProfile } from "next-auth/providers/keycloak"
import { JWT } from "next-auth/jwt";

const keycloak = KeycloakProvider({
    clientId: process.env.KEYCLOAK_ID,
    clientSecret: process.env.KEYCLOAK_SECRET,
    issuer: process.env.KEYCLOAK_ISSUER,
    authorization: { params: { scope: "openid email profile offline_access" } },
});

async function doFinalSignoutHandshake(token: JWT) {
    if (token.provider == keycloak.id) {
        try {
            const issuerUrl = keycloak.options!.issuer!
            const logOutUrl = new URL(`${issuerUrl}/protocol/openid-connect/logout`)
            logOutUrl.searchParams.set("id_token_hint", token.id_token)
            const { status, statusText } = await fetch(logOutUrl);
            console.log("Completed post-logout handshake", status, statusText);
        }
        catch (e: any) {
            console.error("Unable to perform post-logout handshake", e?.code || e)
        }
    }
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
    try {
        // We need the `token_endpoint`.
        const response = await fetch(`${keycloak.options!.issuer}/protocol/openid-connect/token`, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: keycloak.options!.clientId,
                client_secret: keycloak.options!.clientSecret,
                grant_type: "refresh_token",
                refresh_token: token.refresh_token,
            }),
            method: "POST",
        })

        const tokensRaw = await response.json()
        const tokens: KeycloakTokenSet = tokensRaw
        // console.log(tokensRaw)

        if (!response.ok) throw tokens

        const expiresAt = Math.floor(Date.now() / 1000 + tokens.expires_in)
        console.log(`Token was refreshed. New token expires in ${tokens.expires_in} sec at ${expiresAt}, refresh token expires in ${tokens.refresh_expires_in} sec`)
        
        const newToken: JWT = {
            ...token,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            id_token: tokens.id_token,
            expires_at: expiresAt,
            provider: keycloak.id
        }
        return newToken
    } catch (error) {
        // console.error("Error refreshing access token: ", error)
        console.error("Error refreshing access token: ")
        throw error;
    }
}

// For more information on each option (and a full list of options) go to https://next-auth.js.org/configuration/options
export const authOptions: NextAuthOptions = {
    secret: process.env.NEXTAUTH_SECRET,
    // https://next-auth.js.org/configuration/providers/oauth
    providers: [
        keycloak
    ],
    theme: {
        colorScheme: "light",
    },
    callbacks: {
        async jwt({ token, account, user }) {
            console.log('Executing jwt()')
            token.userRole = "admin"
            if (account && user) {
                if(!account.access_token) throw Error('Auth Provider missing access token');
                if(!account.refresh_token) throw Error('Auth Provider missing refresh token');
                if(!account.id_token) throw Error('Auth Provider missing ID token');
                // Save the access token and refresh token in the JWT on the initial login
                const newToken: JWT = {
                    ...token,
                    access_token: account.access_token,
                    refresh_token: account.refresh_token,
                    id_token: account.id_token,
                    expires_at: Math.floor(account.expires_at ?? 0),
                    provider: account.provider,
                }
                return newToken
            }
            
            if (Date.now() < token.expires_at * 1000) {
                // If the access token has not expired yet, return it
                console.log('token is valid')
                return token
            }
            
            // If the access token has expired, try to refresh it
            console.log(`\n>>> Old token expired: ${token.expires_at}`)
            const newToken = await refreshAccessToken(token)
            console.log(`New token acquired: ${newToken.expires_at}`)
            return newToken
        },
        async session({ session, token }) {
            console.log(`Executing session() with token ${token.expires_at}`)
            session.error = token.error
            return session
        },
    },
    events: {
        signOut: async({ session, token }) => doFinalSignoutHandshake(token),
    },
    jwt: {
        maxAge: 1 * 60 // 1 minute, same as in Keycloak
    },
    session: {
        maxAge: 30 * 24 * 60 * 60 // 30 days : 2592000, same as in Keycloak
    }
}

export default NextAuth(authOptions)
