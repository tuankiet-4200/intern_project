export type RecommendationRole = 'CUSTOMER' | 'VENDOR' | 'ADMIN';

export function recommendationRequest(role?: RecommendationRole, limit = 4) {
  const requireAuth = role === 'CUSTOMER' || role === 'VENDOR';
  return {
    path: requireAuth ? `/recommendations?limit=${limit}` : `/recommendations/public?limit=${limit}`,
    requireAuth,
  };
}

export function recommendationExplanation(personalized: boolean) {
  return personalized
    ? 'Dựa trên sản phẩm bạn đã xem, yêu thích, thêm vào giỏ hoặc đặt mua.'
    : 'Các sản phẩm nổi bật dành cho người dùng mới.';
}
