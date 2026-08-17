import { describe, expect, it } from '@jest/globals';
import { governanceStatusLabel, shopStatusActions, userStatusAction } from './admin-governance';

describe('admin governance actions', () => {
  it('requires reasons for punitive user and shop actions', () => {
    expect(userStatusAction('ACTIVE')).toEqual(expect.objectContaining({ target: 'BANNED', reasonRequired: true }));
    expect(shopStatusActions('APPROVED')).toEqual([
      expect.objectContaining({ target: 'SUSPENDED', reasonRequired: true }),
    ]);
    expect(shopStatusActions('PENDING_REVIEW').find((action) => action.target === 'REJECTED'))
      .toEqual(expect.objectContaining({ reasonRequired: true }));
  });

  it('exposes only valid next shop states', () => {
    expect(shopStatusActions('REJECTED').map((action) => action.target)).toEqual(['PENDING_REVIEW']);
    expect(shopStatusActions('SUSPENDED').map((action) => action.target)).toEqual(['APPROVED', 'REJECTED']);
  });

  it('translates persisted governance statuses for operational UI', () => {
    expect(governanceStatusLabel('BANNED')).toBe('Đã khóa');
    expect(governanceStatusLabel('PENDING_REVIEW')).toBe('Chờ duyệt');
    expect(governanceStatusLabel()).toBe('Không xác định');
  });
});
