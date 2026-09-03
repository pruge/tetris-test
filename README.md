# tetris-test

단일 HTML 파일로 만든 1인용 테트리스. 외부 라이브러리·CDN·이미지·빌드 단계가
없다. `tetris.html` 을 브라우저에서 직접 열면 동작한다.

이 저장소의 또 다른 목적은 **[bb](https://github.com/get-bb/bb) 로 에이전트
스레드를 굴려 소프트웨어를 만드는 절차**를 기록하는 것이다. 코드보다 그
절차가 주된 산출물이다.

## 실행

```bash
open tetris.html          # macOS. 또는 브라우저로 파일을 연다
node --test test/         # 테스트 58개, 약 0.25초
```

Node 22+ 가 필요하다. 설치할 의존성은 없다.

## 조작

| 키 | 동작 |
|---|---|
| ← → | 좌우 이동 (DAS 167ms / ARR 33ms) |
| ↓ | 소프트 드롭 |
| Space | 하드 드롭 |
| ↑ / X / Z | 회전 (SRS 월킥) |
| C / Shift | 홀드 |
| P / Esc | 일시정지 |
| R | 재시작 |

좁은 화면에서는 터치 제스처(스와이프·탭)와 화면 버튼을 쓴다.

## 무엇이 들어 있나

표준 가이드라인을 따른다: 7-bag 조각 생성, SRS 월킥, 락 딜레이(500ms, 리셋
15회 상한), 고스트, 홀드, 다음 조각 5개 미리보기, T-스핀 3-corner 판정,
백투백 1.5배, 콤보, 레벨별 낙하 속도, 최고 점수 저장.

## 문서를 읽는 순서

| 문서 | 무엇 |
|---|---|
| [docs/workflow.md](docs/workflow.md) | **여기부터.** bb 기반 개발 절차. 겪은 것만 적혀 있다 |
| [docs/tetris-plan.md](docs/tetris-plan.md) | 레이어 구조, 자료구조 계약, Phase, 결정 사항 |
| [docs/tasks/README.md](docs/tasks/README.md) | 태스크 목록과 **거기서 얻은 교훈** |
| [test/README.md](test/README.md) | 테스트 하네스 구조와 미포함 항목 |
| [.bb/AGENTS.md](.bb/AGENTS.md) | 모든 에이전트 스레드에 자동 주입되는 규약 |

## 코드 구조

`tetris.html` 한 파일이지만 내부는 섹션으로 나뉜다. 경계가 이 프로젝트의
핵심 설계다.

```
CONFIG       모든 상수. 파일의 다른 곳에 숫자 리터럴을 두지 않는다
LOGIC        순수 함수. canvas 도, 시간도, DOM 도 모른다
PERSISTENCE  최고 점수. localStorage 가 죽어도 게임은 죽지 않는다
STATE        보드, 조각, 큐, 타이머
RENDER       canvas 만 안다. 규칙은 모른다
INPUT        키보드·터치를 **의도 객체**로 바꾼다. 규칙을 실행하지 않는다
LOOP         델타 타임 누적. 의도를 소비하고 규칙을 적용한다
```

INPUT 이 `{type:'move', dx:-1}` 같은 의도만 만들고 LOOP 가 적용하기 때문에
키보드와 터치가 같은 경로를 쓴다. 터치 회전이 T-스핀으로 인정되는 것도
이 분리 덕분이다 — 두 기능은 서로 다른 태스크에서 서로를 모른 채 만들어졌다.

## 작업 방식

태스크는 [이슈](../../issues)로 관리한다. 서식은
[`.github/ISSUE_TEMPLATE/task.md`](.github/ISSUE_TEMPLATE/task.md) 를 쓴다.

한 사이클은 이렇게 돈다:

```
이슈 작성 → bb thread spawn (격리된 worktree) → 산출물 회수
  → 구조 검증 (자기 보고를 그대로 믿지 않는다) → PR → 병합 → 스레드 archive
```

절차의 근거와 실패 사례는 [docs/workflow.md](docs/workflow.md) 에 있다.

T-001 ~ T-008 은 리모트가 없던 시기라 `docs/tasks/T-*.md` 파일로 관리했다.
이력으로 남겨 둔다.

## 이 저장소에서 배운 것 몇 가지

- 검증 기준에 **시간 대기를 쓰면 안 된다.** "30초 방치하면 게임 오버" 라고
  썼더니 에이전트가 그대로 기다리다 턴을 소진했다.
- **통과하는 테스트는 아무것도 증명하지 않는다.** 45개를 통과시킨 스위트가
  `resetGame()` 의 필드 하나를 지워도 그대로 통과했다.
- **같은 유형의 결함이 세 번 반복되면** 개별 테스트를 그만두고 구조를
  테스트한다 (`test/reset-completeness.test.js`).
- **리스크는 소유자가 없으면 영원히 리스크로 남는다.** "자동 테스트 없음" 을
  다섯 사이클 동안 문서에 다시 적기만 했다.

전부 [docs/tasks/README.md](docs/tasks/README.md) 하단에 근거와 함께 있다.
