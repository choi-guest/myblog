// 장소 지도와 길찾기 링크
// 카카오 키가 있으면 카카오맵, 없거나 실패하면 키가 필요 없는 구글 지도 삽입으로 대신 보여 준다.

function hasCoords(venue) {
  return Number.isFinite(venue.lat) && Number.isFinite(venue.lng);
}

export function directionLinks(venue) {
  const query = encodeURIComponent(venue.mapQuery || venue.name);
  return {
    // 좌표가 있으면 바로 길찾기, 없으면 장소 검색 결과로 연다
    kakao: hasCoords(venue)
      ? `https://map.kakao.com/link/to/${encodeURIComponent(venue.name)},${venue.lat},${venue.lng}`
      : `https://map.kakao.com/link/search/${query}`,
    naver: `https://map.naver.com/p/search/${query}`,
  };
}

// 키 없이 쓸 수 있는 구글 지도 삽입 주소
export function embedMapUrl(venue) {
  const q = hasCoords(venue) ? `${venue.lat},${venue.lng}` : (venue.mapQuery || venue.address);
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&hl=ko&output=embed`;
}

// 카카오맵 SDK를 한 번만 불러온다. 키가 없거나 실패하면 reject.
function loadKakaoSdk(key) {
  return new Promise((resolve, reject) => {
    if (!key) {
      reject(new Error('카카오 JavaScript 키가 없습니다'));
      return;
    }
    if (window.kakao && window.kakao.maps) {
      window.kakao.maps.load(() => resolve(window.kakao));
      return;
    }
    const script = document.createElement('script');
    // services: 좌표가 없을 때 주소로 좌표를 찾는 데 쓴다
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`;
    script.async = true;
    script.onload = () => {
      if (window.kakao && window.kakao.maps) window.kakao.maps.load(() => resolve(window.kakao));
      else reject(new Error('카카오맵을 불러오지 못했습니다'));
    };
    script.onerror = () => reject(new Error('카카오맵을 불러오지 못했습니다'));
    document.head.appendChild(script);
  });
}

function geocode(kakao, address) {
  return new Promise((resolve, reject) => {
    new kakao.maps.services.Geocoder().addressSearch(address, (result, status) => {
      if (status === kakao.maps.services.Status.OK && result[0]) {
        resolve(new kakao.maps.LatLng(Number(result[0].y), Number(result[0].x)));
      } else {
        reject(new Error('주소로 위치를 찾지 못했습니다'));
      }
    });
  });
}

// container: 지도를 넣을 요소, toggle: [지도 움직이기] 버튼
// 카카오맵을 띄우면 true, 실패하면 false (호출한 쪽이 구글 지도로 대신한다)
export async function initMap(container, toggle, venue, key) {
  let kakao;
  let center;
  try {
    kakao = await loadKakaoSdk(key);
    center = hasCoords(venue) ? new kakao.maps.LatLng(venue.lat, venue.lng) : await geocode(kakao, venue.address);
  } catch {
    return false;
  }

  // 페이지를 넘길 때 지도가 손가락을 잡지 않도록 처음에는 고정
  const map = new kakao.maps.Map(container, { center, level: 4, draggable: false, scrollwheel: false, disableDoubleClickZoom: true });
  map.setZoomable(false);
  map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);

  new kakao.maps.Marker({ map, position: center });
  const label = document.createElement('div');
  label.className = 'map-label';
  label.textContent = venue.name;
  new kakao.maps.CustomOverlay({ map, position: center, content: label, yAnchor: 2.4 });

  let active = false;
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    active = !active;
    map.setDraggable(active);
    map.setZoomable(active);
    container.classList.toggle('is-active', active);
    toggle.textContent = active ? '지도 고정하기' : '지도 움직이기';
    toggle.setAttribute('aria-pressed', String(active));
    if (!active) map.panTo(center);
  });

  // 화면 크기가 바뀌면 지도 크기를 다시 맞춘다
  window.addEventListener('resize', () => {
    map.relayout();
    map.setCenter(center);
  });
  return true;
}
