// daily news 01 — 2026-11-21. Separate from 生词复现 01–03.
// Inline （中文） notes are display glosses. The reader strips them before
// word indexing so they never become English tokens.
// Licenses, credits, and source checks: daily-news-01.md
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
    aurora: ["极光", "auroras"]
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
    }
  ]
};
