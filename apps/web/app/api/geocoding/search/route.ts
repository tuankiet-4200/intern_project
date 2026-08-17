import { NextRequest, NextResponse } from 'next/server';
import { buildSearchUrl, GeocodingInputError, requestNominatim } from '@/lib/geocoding';

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('q') ?? '';
    const payload = await requestNominatim<unknown[]>(buildSearchUrl(query));
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  } catch (error) {
    if (error instanceof GeocodingInputError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: 'Dịch vụ tìm địa chỉ đang tạm thời không khả dụng.' }, { status: 502 });
  }
}
