// 카카오맵 표시와 길찾기 링크

export function directionLinks(venue) {
  const name = encodeURIComponent(venue.name);
  return {
    kakao: `https://map.kakao.com/link/to/${name},${venue.lat},${venue.lng}`,
    naver: `https://map.naver.com/p/search/${encodeURIComponent(venue.address)}`,
  };
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
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
    script.async = true;
    script.onload = () => {
      if (window.kakao && window.kakao.maps) window.kakao.maps.load(() => resolve(window.kakao));
      else reject(new Error('카카오맵을 불러오지 못했습니다'));
    };
    script.onerror = () => reject(new Error('카카오맵을 불러오지 못했습니다'));
    document.head.appendChild(script);
  });
}

// container: 지도를 넣을 요소, toggle: [지도 크게 보기] 버튼
// 성공하면 true, 실패하면 false (호출한 쪽이 대체 화면을 보여 준다)
export async function initMap(container, toggle, venue, key) {
  let kakao;
  try {
    kakao = await loadKakaoSdk(key);
  } catch {
    return false;
  }

  const center = new kakao.maps.LatLng(venue.lat, venue.lng);
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
