# Источники визуальных материалов

Все перечисленные файлы скопированы в `public/assets/` для стабильного локального запуска. SHA-256 сверены после копирования. Исходные пользовательские файлы и исследовательские оригиналы не изменялись.

| Файл в проекте | Источник | Использование | SHA-256 |
|---|---|---|---|
| `art/perseus-cutout.png` | `../art-direction/perseus/hero-assets/perseus-cutout-user-supplied.png` | Утверждённый пользовательский вырез Персея; маски тела и чаши строятся во время загрузки | `c1ff862f5e2f3914709e07cb5ea88ea079d26ec5b4de841ad37a824fb57b08f8` |
| `art/background.png` | `../art-direction/perseus/final/background-user-photoshop-master-v1.png` | Утверждённый живописный фон | `715e2cc68474a9d0eb266ec78f6e2fccb7553268028cef6c034b97f23325404d` |
| `shopify/finance.glb` | [Shopify Finance GLB](https://editions-winter-2026.myshopify.com/cdn/shop/3d/models/o/614d6d0fa1836313/EW26_Finance_251208v2_compressed-optimized.glb), локальный оригинал `../references/version-4/Ассеты_референса/Shopify_Finance/` | Геометрия/материал `shiny-coin1` для центрального знака и потока | `61571e16d71c7d1439b4ef89beef90a54d008ba09955ff95877670c55548f148` |
| `shopify/sidekick.glb` | [Shopify Sidekick GLB](https://editions-winter-2026.myshopify.com/cdn/shop/3d/models/o/63ac5b514230f82a/EW26_Sidekick_251208_compressed-optimized.glb), локальный оригинал `../references/sidekick-transition-audit/` | Материал `Sidekick-v3-metallic` как основа настройки 3D-чаши; геометрия колец не выдаётся за чашу | `662cdea6238f602436c32fd50c6e9561c8332864da88d381f6b1e98df524b503` |
| `shopify/mud_normal.webp` | [Shopify texture](https://cdn.shopify.com/s/files/1/0951/3130/4218/files/mud_normal.webp?v=1762463320), локальный оригинал `../references/version-4/Ассеты_референса/Shopify_Finance/` | Живой тонкий край золотого фронта | `8780cb023bc028bde774e77b8e0f552cfb3e6ddbcf827de8c7a84c7b47912fea` |
| `shopify/studio_small_09_1k.pmrem.ktx2` | [Shopify PMREM](https://cdn.shopify.com/s/files/1/0951/3130/4218/files/studio_small_09_1k.pmrem.ktx2?v=1765211412), локальный оригинал `../references/version-4/Ассеты_референса/Shopify_Finance/` | Световое окружение металлических объектов | `9bef1112f38222b67f77d6956e3369b6746e3a33ef5345d3fbba9250a8037d08` |

Формула края в `src/scene.ts` адаптирована из точного локального извлечения `../references/sidekick-transition-audit/Overlay.original.frag` (2168 байт) из [Shopify Effects runtime](https://cdn.shopify.com/oxygen-v2/47215/49013/102837/4351350/assets/Effects-WhEp4HUr.js): сохранены поле `mudNormal`, движущийся шум и порог снизу вверх; цвет, сглаживание и порядок композитинга адаптированы под МИДИС. Для композиции и ритма использованы [живой раздел Sidekick](https://www.shopify.com/editions/winter2026#sidekick) и локальные скриншоты референса.

**Права:** публичная доступность Shopify-файлов не подтверждает право на их переиспользование. Этот этап — внутренний макет для ревью. Перед внешней публикацией, продажей или рекламой нужно получить разрешение либо заменить соответствующие ассеты своими.


## Sidekick — точечный перенос, 02.10.2026

Источник: https://www.shopify.com/editions/winter2026#sidekick . Из локального route `Fs` и `tailwind-G-N6aznT.css` перенесены desktop-сетка, метрики NeueMontreal/HWCigars и ImperialScript-буквица. Текст взят из двух предоставленных пользователем скриншотов; медиа заменено пустым прямоугольником 16:9.

`public/assets/fonts/ImperialScript.woff2`: https://cdn.shopify.com/b/shopify-brochure2-assets/389d4f8566b3b9cbe083b682c7fabf06.woff2 .

По последующим указаниям пользователя движение адаптировано: первый кадр удерживается на протяжении 1,6 высоты прокрутки; наезд к чаше +5% с 0,2 до 1,3 высоты; отдельный фон cover. Вертикальные траектории текста остаются обычной прокруткой.

## Последующая итерация — хедер, меню и русская типографика

- Louver: https://louver.framer.website/ . Архив исходника и замеров — `../references/louver-header-audit/`. Из `https://framerusercontent.com/sites/4cUoRKq7xT3aJapjwckiYO/shared-lib.BdX-LD-o.mjs` перенесены смещение `((pointer - rect origin) / rect size - .5) * 16`, затемнение `.86`, переходы 300/450 мс с `cubic-bezier(.22,1,.36,1)`. Подписи, шрифты и золотой фон изменены по последующим указаниям пользователя.
- Larian: https://larian.com/careers . Основное меню `MORE`, а не виджет аккаунта: `.menu-layer { transform: translateY(-100%); transition: transform .5s ease; }`, открытое `translateY(0)`. Панель 580 px на проверенном desktop, полный экран на узком; содержимое намеренно пустое. Цвет `#dcd0b1` воспроизводит sRGB золотой заливки второго экрана, зерно взято из существующей сцены.
- Два семейства в текущей композиции: Cormorant Garamond и Great Vibes. У Great Vibes оставлена каллиграфическая буква «О»; остальная часть «Олимп» набрана читаемым Cormorant по замечанию пользователя.
- Cormorant Garamond Bold: https://fonts.gstatic.com/s/cormorantgaramond/v21/co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_hg9GnM.ttf . Great Vibes: https://fonts.gstatic.com/s/greatvibes/v21/RWmMoKWR9v4ksMfaWd_JN-XC.ttf . OFL сохранены рядом. Наличие кириллицы Great Vibes проверено по https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/METADATA.pb .
- «МИДИС» — геометрия пяти кириллических глифов Cormorant Bold, подготовленная `scripts/build-gold-wordmark.mjs`, 16 460 треугольников. В браузере не загружается парсер шрифтов. Надпись находится за цельным силуэтом Персея, движение совпадает с HTML-заголовком. По последнему указанию возвращён золотой материал, согласованный с освещением сцены. Материалы чаши и монет не изменены; пробный дополнительный контровой свет удалён.
- `src/intro-cover.ts` использует порог и шум оригинального crossfade-шейдера Shopify с общими uniform-параметрами основной сцены, адаптируя результат в прозрачность временного слоя над DOM. После проявления этот слой освобождается.
- Последний ритм: первая надпись начинается по центру; следующая текстовая сцена — на 1,55 высоты окна. Начало заливки вычисляется по концу абзаца, а не фиксированной паузой после него; интервал между текстовыми сценами сохранён.
