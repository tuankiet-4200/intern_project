export type AddressDraft = {
  recipient: string;
  phone: string;
  line1: string;
  ward: string;
  district: string;
  city: string;
};

export type NominatimPlace = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  address?: {
    house_number?: string;
    road?: string;
    pedestrian?: string;
    neighbourhood?: string;
    quarter?: string;
    suburb?: string;
    village?: string;
    town?: string;
    city?: string;
    city_district?: string;
    district?: string;
    county?: string;
    state_district?: string;
    state?: string;
    province?: string;
  };
};

export const EMPTY_ADDRESS: AddressDraft = {
  recipient: '',
  phone: '',
  line1: '',
  ward: '',
  district: '',
  city: '',
};

export function addressDraftFromPlace(place: NominatimPlace): Partial<AddressDraft> {
  const address = place.address ?? {};
  const road = address.road ?? address.pedestrian ?? '';
  const line1 = [address.house_number, road].filter(Boolean).join(' ').trim()
    || place.name?.trim()
    || place.display_name.split(',')[0]?.trim()
    || '';

  return {
    line1,
    ward: firstValue(address.suburb, address.quarter, address.neighbourhood, address.village),
    district: firstValue(address.city_district, address.district, address.county, address.state_district),
    city: firstValue(address.city, address.province, address.state, address.town),
  };
}

export function mergeLocatedAddress(current: AddressDraft, located: Partial<AddressDraft>): AddressDraft {
  return {
    ...current,
    line1: located.line1?.trim() || current.line1,
    ward: located.ward?.trim() || current.ward,
    district: located.district?.trim() || current.district,
    city: located.city?.trim() || current.city,
  };
}

function firstValue(...values: Array<string | undefined>) {
  return values.find((value) => value?.trim())?.trim() ?? '';
}
