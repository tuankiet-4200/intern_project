import { describe, expect, it } from '@jest/globals';
import { addressDraftFromPlace, EMPTY_ADDRESS, mergeLocatedAddress } from './address';

describe('address helpers', () => {
  it('maps Vietnamese Nominatim fields into the checkout address shape', () => {
    expect(addressDraftFromPlace({
      place_id: 1,
      display_name: '1 Võ Văn Ngân, Phường Linh Chiểu, Thành phố Thủ Đức, Thành phố Hồ Chí Minh',
      lat: '10.8506',
      lon: '106.7719',
      address: {
        house_number: '1',
        road: 'Võ Văn Ngân',
        suburb: 'Phường Linh Chiểu',
        city_district: 'Thành phố Thủ Đức',
        city: 'Thành phố Hồ Chí Minh',
      },
    })).toEqual({
      line1: '1 Võ Văn Ngân',
      ward: 'Phường Linh Chiểu',
      district: 'Thành phố Thủ Đức',
      city: 'Thành phố Hồ Chí Minh',
    });
  });

  it('keeps manually entered fields when the map provider omits them', () => {
    const current = { ...EMPTY_ADDRESS, recipient: 'Nguyễn An', phone: '0912345678', ward: 'Phường 1' };
    expect(mergeLocatedAddress(current, { line1: '20 Lê Lợi', ward: '', city: 'Hồ Chí Minh' })).toEqual({
      ...current,
      line1: '20 Lê Lợi',
      city: 'Hồ Chí Minh',
    });
  });
});
