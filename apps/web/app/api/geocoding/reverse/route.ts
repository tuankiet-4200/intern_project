import { NextRequest, NextResponse } from 'next/server';
import { buildReverseUrl, GeocodingInputError, requestNominatim } from '@/lib/geocoding';

export async function GET(request: NextRequest) {
  try {
    const latitude = request.nextUrl.searchParams.get('lat') ?? '';
    const longitude = request.nextUrl.searchParams.get('lon') ?? '';
    const payload = await requestNominatim<unknown>(buildReverseUrl(latitude, longitude));
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  } catch (error) {
    if (error instanceof GeocodingInputError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: 'Dịch vụ đọc địa chỉ đang tạm thời không khả dụng.' }, { status: 502 });
  }
}
