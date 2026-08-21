// 文物数据 —— 3D 模型来自 Sketchfab CC0 馆藏扫描
window.WenwuData = [
  {
    id: "zun",
    name: "鸮尊",
    era: "商晚期 · 公元前13-12世纪",
    collection: "明尼阿波利斯艺术馆 · CC0",
    thumb: "./assets/models/zun_thumb.jpg",
    pieces: [
      { glb: "zun_frag_0.glb", mat: "body" },
      { glb: "zun_frag_1.glb", mat: "body" },
      { glb: "zun_frag_2.glb", mat: "body" },
      { glb: "zun_frag_3.glb", mat: "body" },
      { glb: "zun_frag_4.glb", mat: "body" },
      { glb: "zun_frag_5.glb", mat: "body" },
      { glb: "zun_head.glb", mat: "head" }
    ],
    mats: { body: "zun_body", head: "zun_head" },
    know: "鸮尊是商代晚期的青铜酒器，以猫头鹰（鸮）为形。尊为盛酒之器，用于祭祀宴飨；鸮在商代被视为勇猛之鸟，铸于礼器，寄寓通神之力。此尊 1946 年出土于河南，现藏明尼阿波利斯艺术馆。",
    quiz: {
      question: "擦亮了——商周青铜器上最常见的兽面纹，古人称它为什么？",
      options: ["饕餮纹", "蟠螭纹", "涡纹"],
      answer: 0,
      explain: "饕餮纹是商周青铜器最典型的纹样：一张对称的兽面，巨目裂口，威严神秘。学者认为它沟通人神、警示贪欲，是礼器权力的象征。鸮尊通体即以饕餮与鸮形纹饰装点。"
    }
  }
];
