// daily news 01 — 2026-11-21. Separate from 生词复现 01–03.
// Inline （中文） notes are display glosses. The reader strips them before
// word indexing so they never become English tokens.
// Licenses, credits, and source checks: daily-news-01.md
// Articles 04–06 show official news art with credit and a source link.
// That display is not a claim that a separate republication license was granted.
const newsImageNote = "官方新闻配图，只随这篇报道展示。本站没有获得单独转载许可，也不表示与版权方有关。";
const dailyNews01 = {
  columnTitle: "daily news 01",
  editionDate: "2026-11-21",
  words: {
    spacecraft: ["航天器"],
    interstellar: ["星际的"],
    sample: ["样品", "samples"],
    vessel: ["血管"],
    tumor: ["肿瘤"],
    "splash down": ["溅落"],
    mission: ["任务"],
    plasma: ["等离子体"],
    "charged particles": ["带电粒子"],
    "solar wind": ["太阳风"],
    "magnetic field": ["磁场"],
    aurora: ["极光", "auroras"],
    blueprint: ["蓝图", "blueprints"],
    "scene graph": ["场景图"],
    "early access": ["抢先体验版"],
    "world model": ["世界模型"],
    synthid: ["隐形水印"],
    "precise edit": ["精确编辑"]
  },
  stories: [
    {
      id: "daily-news-01-01",
      title: "Voyager 1 Reaches One Light-Day from Earth",
      topic: "旅行者1号飞到了“一光日”之外",
      illustration: ["01-voyager-1-light-day-nasa-jpl.jpg", "艺术想象图：旅行者1号在星空中，一条光伸向远方。"],
      figure: {
        wide: true,
        width: 2000,
        height: 1125,
        caption: "艺术想象图：旅行者1号于2026年11月18日到达距离地球一光日的位置。不是实拍。",
        credit: "NASA/JPL-Caltech",
        date: "2026-11-18",
        sourceUrl: "https://www.nasa.gov/news-release/nasas-voyager-1-makes-history-reaching-one-light-day-from-earth/",
        sourceLabel: "NASA 新闻稿"
      },
      sources: [
        {
          label: "NASA 新闻稿，2026-11-19",
          url: "https://www.nasa.gov/news-release/nasas-voyager-1-makes-history-reaching-one-light-day-from-earth/"
        },
        {
          label: "NASA Science：什么是一光日",
          url: "https://science.nasa.gov/mission/voyager/voyager-1/voyager-1-what-is-a-light-day/"
        }
      ],
      paragraphs: [
        [
          ["Voyager 1 left Earth in 1977.", "旅行者1号在1977年离开地球。"],
          ["On November 18, 2026, it reached a new mark: one light-day from Earth.", "2026年11月18日，它到达了一个新纪录：距离地球一光日。"],
          ["A light-day is the distance light can travel in one day.", "一光日就是光在一天里能走的距离。"],
          ["That is about 25.9 billion kilometers.", "大约是259亿公里。"]
        ],
        [
          ["The spacecraft（航天器）is now so far away that a radio signal takes 24 hours to reach it.", "这艘航天器现在非常远，无线电信号要走24小时才能到达它那里。"],
          ["A message back to Earth also takes 24 hours.", "返回地球的消息也要再走24小时。"],
          ["NASA heard from Voyager 1 the next day and confirmed the news.", "美国宇航局（NASA）在第二天收到信号，确认了这件事。"]
        ],
        [
          ["Voyager 1 is the farthest human-made object in space.", "旅行者1号是人类制造的、飞得最远的物体。"],
          ["In 2012, it entered interstellar（星际的）space, the space between the stars.", "2012年，它进入了恒星与恒星之间的星际空间。"],
          ["It still sends a simple signal to Earth.", "它仍在向地球发出简单信号。"],
          ["Science data stopped a few days earlier, but engineers say the craft is still flying.", "几天前，科学数据停了，但工程师说它还在飞行。"],
          ["After almost 50 years, this small traveler keeps going.", "快50年了，这个小旅行者还在往前走。"]
        ]
      ]
    },
    {
      id: "daily-news-01-02",
      title: "A Dragon Ship Leaves the Space Station with Science",
      topic: "龙飞船带着科学样品离开空间站",
      illustration: ["02-dragon-approaches-iss-iss075e0226575.jpg", "白色龙飞船的照片，舱门打开，背景是黑色的太空。"],
      figure: {
        wide: true,
        width: 2000,
        height: 1123,
        caption: "2026年10月15日，这艘龙飞船到达国际空间站时的照片。不是11月20日离开的瞬间。",
        credit: "NASA",
        date: "2026-10-15",
        sourceUrl: "https://www.nasa.gov/blogs/general-blog/2026/11/20/dragon-prepares-to-depart-station-for-earth-return/",
        sourceLabel: "NASA 博客"
      },
      sources: [
        {
          label: "NASA：龙飞船离开空间站，2026-11-20",
          url: "https://www.nasa.gov/blogs/general-blog/2026/11/20/dragon-undocks-from-station-packed-with-science-and-cargo/"
        },
        {
          label: "NASA：离开前的准备，2026-11-20",
          url: "https://www.nasa.gov/blogs/general-blog/2026/11/20/dragon-prepares-to-depart-station-for-earth-return/"
        }
      ],
      paragraphs: [
        [
          ["On November 20, 2026, a SpaceX Dragon ship left the International Space Station.", "2026年11月20日，一艘SpaceX“龙”飞船离开了国际空间站。"],
          ["No people were on board.", "船上没有人。"],
          ["It pulled away at 12:05 in the afternoon, eastern United States time.", "它在美国东部时间下午12:05离开。"]
        ],
        [
          ["The ship arrived on October 15 with more than 2,860 kilograms of food, supplies, and test materials.", "这艘飞船在10月15日到达空间站，带去了超过2860公斤的食物、补给和实验材料。"],
          ["Now it is coming home with science samples（样品）.", "现在它正把科学样品带回地球。"],
          ["One is a small blood vessel（血管）made with a 3D printer.", "其中有一件是用3D打印机制成的细小血管。"],
          ["Scientists will use it to study heart disease.", "科学家会用它研究心脏病。"],
          ["The ship also carries frozen tumor（肿瘤）models for cancer research, and bacteria that do not fear some medicines.", "船上还有冷冻的肿瘤模型，用来研究癌症，也有不怕某些药物的细菌。"]
        ],
        [
          ["NASA says the ship should splash down（溅落）in the sea near California on November 21, eastern United States time.", "美国宇航局说，飞船预计在美国东部时间11月21日溅落在加州附近的海上。"],
          ["At the time of this writing, that landing has not happened yet.", "写这篇稿件时，降落还没有发生。"]
        ]
      ]
    },
    {
      id: "daily-news-01-03",
      title: "Europe Chooses a Seven-Ship Mission to Study Space Plasma",
      topic: "欧洲选定七星任务，研究太空中的等离子体",
      illustration: ["03-earth-plasma-environment-esa.jpg", "艺术想象图：地球被彩色的等离子体流包围，角落有 ESA 标志。"],
      figure: {
        wide: true,
        width: 2000,
        height: 1125,
        caption: "艺术想象图：地球磁层以及等离子体在其中和周围的运动。",
        note: "图中有 ESA 标志。仅供学习阅读，不表示 ESA 认可本站。",
        credit: "©ESA",
        sourceUrl: "https://www.esa.int/articles/about-us/directorates/science/seven-spacecraft-observatory-to-study-plasma-universe",
        sourceLabel: "ESA 文章"
      },
      sources: [
        {
          label: "ESA：七艘航天器观测等离子体，2026-11-19",
          url: "https://www.esa.int/articles/about-us/directorates/science/seven-spacecraft-observatory-to-study-plasma-universe"
        }
      ],
      paragraphs: [
        [
          ["On November 19, 2026, European countries chose a new space mission（任务）.", "2026年11月19日，欧洲各国选定了一项新的太空任务。"],
          ["It is called Plasma Observatory.", "它的名字是Plasma Observatory（等离子体观测站）。"],
          ["Plasma（等离子体）is a kind of gas made of charged particles（带电粒子）.", "等离子体是一种由带电粒子组成的气体。"],
          ["It makes up most of the visible universe, including the Sun.", "可见宇宙里的大部分物质都是它，包括太阳。"]
        ],
        [
          ["The Sun blows plasma into space.", "太阳会把等离子体吹到太空中。"],
          ["This stream is called the solar wind（太阳风）.", "这股气流叫太阳风。"],
          ["When it reaches Earth, our magnetic field（磁场）acts like a shield.", "它来到地球时，地球的磁场会像盾一样保护我们。"],
          ["Sometimes this meeting makes the beautiful lights in the north and south sky, called auroras（极光）.", "有时，这种相遇会在南北天空形成美丽的光，叫做极光。"]
        ],
        [
          ["The new mission will use seven spacecraft（航天器）flying together.", "新任务将用七艘航天器一起飞行。"],
          ["They will watch how the Sun's energy moves through Earth's magnetic shield, at both small and large scales.", "它们会观察太阳的能量如何穿过地球的磁盾，既看小尺度，也看大尺度。"],
          ["ESA, the European Space Agency, says the ships may launch in the late 2030s.", "欧洲航天局（ESA）表示，这些航天器可能在2030年代末期发射。"]
        ]
      ]
    },
    {
      id: "daily-news-01-04",
      title: "Epic Updates the Plan for Unreal Engine 6",
      topic: "虚幻引擎6更新计划：将不再使用蓝图",
      illustration: ["04-unreal-ue6-official-cms.jpg", "紫蓝色玻璃状几何图形，是虚幻引擎这篇新闻的官方配图。"],
      figure: {
        wide: true,
        width: 1920,
        height: 1080,
        caption: "虚幻引擎 2026-11-20 新闻《An update on Blueprints and the path to UE6》的官方配图。",
        note: newsImageNote,
        credit: "Epic Games / Unreal Engine",
        date: "2026-11-20",
        sourceUrl: "https://www.unrealengine.com/news/an-update-on-blueprints-and-the-path-to-ue6",
        sourceLabel: "Unreal Engine 新闻"
      },
      sources: [
        {
          label: "Unreal Engine 官方说明，2026-11-20",
          url: "https://www.unrealengine.com/news/an-update-on-blueprints-and-the-path-to-ue6"
        },
        {
          label: "Unreal Engine 5.9 Preview 说明，更新于 2026-11-19",
          url: "https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-5-9-release-notes"
        }
      ],
      paragraphs: [
        [
          ["On November 20, 2026, Unreal Engine published an official update about Unreal Engine 6, called UE6.", "2026年11月20日，虚幻引擎发布了关于 Unreal Engine 6（简称 UE6）的官方更新。"],
          ["UE6 projects will not include Blueprints（蓝图）or the Actor gameplay system.", "UE6 项目将不再包含蓝图，也不再包含 Actor 游戏玩法系统。"],
          ["Gameplay will be built with a language called Verse, and with a new Scene Graph（场景图）.", "游戏逻辑将用名为 Verse 的语言，以及新的场景图来编写。"],
          ["That change starts with Early Access（抢先体验版）.", "这一变化从抢先体验版开始。"],
          ["Early Access is not available yet.", "抢先体验版现在还不能下载。"]
        ],
        [
          ["This is a plan, not a new engine you can download today.", "这是计划，不是今天就能下载的新引擎。"]
        ],
        [
          ["Unreal Engine 5.9 is still a preview.", "虚幻引擎 5.9 现在仍是预览版。"],
          ["Its notes were updated on November 19, 2026.", "它的说明在 2026年11月19日更新过。"],
          ["Those Preview 2 notes describe more AI tools, and a way for Blueprint-only projects to run on the web.", "其中的 Preview 2 说明写了更多 AI 工具，也写了只使用蓝图的项目可以在网页上运行。"]
        ]
      ]
    },
    {
      id: "daily-news-01-05",
      title: "Google Opens Genie 4 to Developers",
      topic: "谷歌向开发者开放 Genie 4",
      illustration: ["05-genie-4-google-blog-social.jpg", "官方博客图，写着 Genie 4，以及 Now available in the Gemini API and Google AI Studio。"],
      figure: {
        wide: true,
        width: 1440,
        height: 810,
        caption: "谷歌 2026-11-19 博客配图：Genie 4 已可在 Gemini API 和 Google AI Studio 使用。",
        note: newsImageNote,
        credit: "Source: Google",
        date: "2026-11-19",
        sourceUrl: "https://blog.google/innovation-and-ai/technology/developers-tools/genie-4-in-gemini-api/",
        sourceLabel: "Google 博客"
      },
      sources: [
        {
          label: "Google：开发者可用，2026-11-19",
          url: "https://blog.google/innovation-and-ai/technology/developers-tools/genie-4-in-gemini-api/"
        },
        {
          label: "Google：Project Genie，2026-11-18",
          url: "https://blog.google/innovation-and-ai/models-and-research/google-deepmind/genie-4-now-available-project-genie/"
        },
        {
          label: "Gemini API 文档：Genie 4 的限制",
          url: "https://aistudio.google.com/docs/genie"
        }
      ],
      paragraphs: [
        [
          ["On November 19, 2026, Google opened Genie 4 to developers through the Gemini API and Google AI Studio.", "2026年11月19日，谷歌通过 Gemini API 和 Google AI Studio，向开发者开放了 Genie 4。"],
          ["One day earlier, on November 18, eligible Google AI Ultra users could try it in Project Genie.", "再早一天，也就是 11月18日，符合条件的 Google AI Ultra 用户已可以在 Project Genie 里试用。"]
        ],
        [
          ["Genie 4 is a world model（世界模型）.", "Genie 4 是一种世界模型。"],
          ["You can start with words, a picture, or both.", "你可以用文字、一张图片，或两者一起开始。"],
          ["Then you can move through a 720p world at 24 frames a second, with sound.", "然后你可以在 720p、每秒 24 帧的世界里移动，并听到声音。"],
          ["You can type during a session to change the weather, the light, or objects.", "你还可以在使用过程中输入文字，改变天气、光线或物体。"],
          ["The video carries a SynthID（隐形水印）mark.", "生成的视频带有 SynthID 隐形水印。"]
        ],
        [
          ["This tool is for tests and early ideas.", "这个工具适合测试和早期想法。"],
          ["Official docs say one session can last up to 120 seconds.", "官方文档说，一次使用最长 120 秒。"],
          ["The world is not a 3D scene you can save.", "这个世界不是可以保存下来的三维场景。"],
          ["If you look away for about eight seconds, some objects may change.", "如果你把视线转开大约八秒，有些物体可能会变化。"],
          ["It is a paid service.", "它是付费服务。"]
        ]
      ]
    },
    {
      id: "daily-news-01-06",
      title: "Ideogram 4.6 Arrives with Native 4K Edits",
      topic: "Ideogram 4.6 上线，可直接生成和修改 4K 图片",
      illustration: ["06-ideogram-46-official-og.jpg", "一只粉色的鸟，旁边有 Ideogram 标志和标语 Think it. Make it. Own it."],
      figure: {
        wide: true,
        width: 1200,
        height: 630,
        caption: "Ideogram 4.6 官方产品页社交图，标语为 Think it. Make it. Own it.",
        note: newsImageNote,
        credit: "Ideogram",
        date: "2026-11-19",
        sourceUrl: "https://ideogram.ai/models/4.6/",
        sourceLabel: "Ideogram 4.6"
      },
      sources: [
        {
          label: "Ideogram 4.6 官方页，2026-11-19",
          url: "https://ideogram.ai/models/4.6/"
        }
      ],
      paragraphs: [
        [
          ["On November 19, 2026, Ideogram released version 4.6.", "2026年11月19日，Ideogram 发布了 4.6 版本。"],
          ["The company says it is now live in its app and its API.", "公司表示，它已在自己的应用和 API 里上线。"],
          ["This is a public release, not a closed test.", "这是公开发布，不是封闭测试。"]
        ],
        [
          ["Ideogram 4.6 can make images at up to 4K.", "Ideogram 4.6 可以生成最高 4K 的图片。"],
          ["The company says the picture is made at that size from the start, not made small and then enlarged.", "公司称，画面从一开始就按这个尺寸生成，不是先做小图再放大。"],
          ["A Precise Edit（精确编辑）tool can change one part of a picture, such as a color or a material, and try to keep the rest the same.", "精确编辑工具可以改动图片的一部分，比如颜色或材质，并尽量让其余部分保持原样。"],
          ["You can make one change, check the result, and then make another.", "你也可以先改一处、检查结果，再继续改下一处。"]
        ],
        [
          ["Ideogram says the model ranked first on a Rapidata multi-step edit list dated November 17.", "Ideogram 说，该模型在 11月17日的 Rapidata 多步编辑名单上排在第一。"],
          ["That score is their announced snapshot, not our own test.", "这个名次来自他们公布的快照，不是我们自己的测试。"],
          ["Check faces, colors, and text before you use a result.", "使用结果前应检查人脸、颜色和文字。"]
        ]
      ]
    }
  ]
};
