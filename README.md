# Steam 할인 캘린더

Steam 공식 예정 행사와 Store 공개 데이터를 하루 한 번 수집해 정적 JSON으로 제공하는 한국어 월간 캘린더입니다.

## 데이터 원칙

- 행사 일정은 [Steamworks Upcoming Events](https://partner.steamgames.com/doc/marketing/upcoming_events) 공개 페이지에서 수집합니다.
- 게임·가격·할인 정보는 Steam Store의 공개 `featuredcategories` 및 `appdetails` 응답만 사용합니다.
- 대량 호출을 피하기 위해 매일 한 번, Store 추천 후보 최대 50개만 조회합니다.
- 일정 페이지의 마크업이 바뀌거나 수집이 실패하면 기존 `data/events.json`을 유지합니다.
- API 키나 비밀값을 사용하지 않으며, 프론트엔드는 생성된 JSON만 읽습니다.

## 운영

GitHub Actions의 **Update Steam sale calendar and deploy** 워크플로가 매일 02:17 UTC에 데이터를 갱신하고 GitHub Pages에 배포합니다. Actions 화면의 **Run workflow**로 수동 갱신도 할 수 있습니다.

GitHub Pages 설정에서 배포 원본을 **GitHub Actions**로 한 번 선택하세요.
