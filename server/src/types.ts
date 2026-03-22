// Type definitions for Hono context variables

export interface User {
  id: number
  username: string
  email: string | null
  admin: boolean
}

export type Variables = {
  user?: User
}
