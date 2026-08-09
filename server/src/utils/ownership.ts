export interface OwnableUser {
  id: number
  admin: boolean
}

export interface OwnedEntity {
  user_id: number | null
}

export function canModify(user: OwnableUser | undefined, entity: OwnedEntity): boolean {
  return !!user && (user.admin || entity.user_id === user.id)
}
