import type { FeedPost, SharedPost } from '../data'
import type { Route } from '../nav'

/** Un restaurant identifié n'est jamais utilisé comme identité de l'auteur. */
export function feedAuthorRoute(post: FeedPost): Route | null {
  if (post.authorType === 'member') {
    return post.memberId ? { name: 'memberProfile', memberId: post.memberId } : null
  }
  return { name: 'restaurant', restaurantId: post.restaurantId }
}

/** Les FoodShare validés par les restaurants rejoignent le fil public. */
export function shareToFeedPost(share: SharedPost): FeedPost {
  return {
    id: share.id + 1_000_000,
    restaurantId: share.restaurantId,
    authorType: 'member',
    memberId: share.memberId,
    author: share.author,
    verified: false,
    image: share.image,
    likes: 0,
    text: share.caption || 'A partagé sa visite via FoodShare.',
    time: share.time,
  }
}
