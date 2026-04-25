/**
 * 地图要素分类目录：terrainType 存稳定英文 id，界面用语中文 label。
 * 颜色按 id 前缀粗分，便于区分大类。
 */

export type MapTerrainEntry = { id: string; label: string }

export type MapTerrainSection = {
  title: string
  groups: { title: string; items: MapTerrainEntry[] }[]
}

function entry(id: string, label: string): MapTerrainEntry {
  return { id, label }
}

/** 按前缀给默认填充色（建筑 / 地貌 / 水系等） */
export function getDefaultTerrainColor(terrainId: string): string {
  const id = terrainId.trim()
  if (!id) return '#9ca3af'
  const legacy = LEGACY_TERRAIN_ALIASES[id]
  if (legacy) return getDefaultTerrainColor(legacy)
  if (id.startsWith('res_')) return '#c4a574'
  if (id.startsWith('com_')) return '#e9a3c9'
  if (id.startsWith('ind_')) return '#94a3b8'
  if (id.startsWith('pub_')) return '#7dd3fc'
  if (id.startsWith('spl_')) return '#c4b5fd'
  if (id.startsWith('land_')) return '#86efac'
  if (id.startsWith('water_')) return '#38bdf8'
  if (id.startsWith('road_')) return '#57534e'
  if (id.startsWith('bridge_')) return '#78716c'
  if (id.startsWith('traf_')) return '#fbbf24'
  if (id.startsWith('lm_')) return '#f472b6'
  if (id.startsWith('rec_')) return '#4ade80'
  if (id.startsWith('nat_')) return '#22c55e'
  if (id.startsWith('zone_')) return '#a78bfa'
  if (id.startsWith('dec_')) return '#fb7185'
  return '#9ca3af'
}

/** 旧版枚举 id → 新目录 id */
export const LEGACY_TERRAIN_ALIASES: Record<string, string> = {
  ocean: 'water_nat_ocean',
  shallow: 'water_nat_bay',
  coast: 'land_plain_wetland',
  plain: 'land_plain_grass',
  grass: 'land_plain_grass',
  forest: 'nat_forest_park',
  mountain: 'land_mtn_mountain',
  snow: 'land_other_glacier',
  desert: 'land_plain_desert',
  river: 'water_nat_river',
  lake: 'water_nat_lake',
  road: 'road_city_car_lane',
  border: 'zone_gov',
  city: 'com_rt_department',
  village: 'res_low_nongshe',
  castle: 'spl_lm_monument',
  temple: 'pub_rel_temple',
  fort: 'zone_military',
  port: 'spl_tr_port',
  battlefield: 'land_mtn_plain',
  forbidden: 'nat_reserve',
  other: 'land_plain_wasteland',
}

export function isBuiltUpTerrainId(id: string): boolean {
  return /^(res_|com_|pub_|spl_tr_|spl_lm_|ind_|zone_(commercial|residential|industrial))/.test(id.trim())
}

/** 供 AI 与图例：扁平 id 列表 */
export function getAllTerrainIds(): string[] {
  const out: string[] = []
  for (const sec of WORLD_MAP_CATALOG) {
    for (const g of sec.groups) {
      for (const it of g.items) out.push(it.id)
    }
  }
  return out
}

export function findTerrainLabel(id: string): string {
  const legacy = LEGACY_TERRAIN_ALIASES[id]
  if (legacy) return findTerrainLabel(legacy)
  for (const sec of WORLD_MAP_CATALOG) {
    for (const g of sec.groups) {
      const f = g.items.find((x) => x.id === id)
      if (f) return f.label
    }
  }
  return id
}

/** 分类目录（住宅 / 商业 / 地貌 / 道路 …） */
export const WORLD_MAP_CATALOG: MapTerrainSection[] = [
  {
    title: '住宅建筑',
    groups: [
      {
        title: '低层',
        items: [
          entry('res_low_villa', '独栋别墅'),
          entry('res_low_bungalow', '平房'),
          entry('res_low_siheyuan', '四合院'),
          entry('res_low_farm', '农舍'),
          entry('res_low_container', '集装箱住宅'),
        ],
      },
      {
        title: '中层',
        items: [entry('res_mid_apartment', '公寓楼'), entry('res_mid_unit', '单元楼')],
      },
      {
        title: '高层',
        items: [
          entry('res_high_tower', '住宅楼'),
          entry('res_high_apartment', '高层公寓'),
          entry('res_high_mixed', '商住楼'),
        ],
      },
      {
        title: '特殊',
        items: [
          entry('res_sp_senior', '老年公寓'),
          entry('res_sp_dorm_student', '学生宿舍'),
          entry('res_sp_dorm_staff', '员工宿舍'),
          entry('res_sp_homestay', '民宿'),
        ],
      },
    ],
  },
  {
    title: '商业建筑',
    groups: [
      {
        title: '零售',
        items: [
          entry('com_rt_convenience', '便利店'),
          entry('com_rt_supermarket', '超市'),
          entry('com_rt_department', '百货商场'),
          entry('com_rt_mall', '购物中心'),
          entry('com_rt_specialty', '专卖店'),
          entry('com_rt_grocery', '杂货店'),
          entry('com_rt_hardware', '五金店'),
          entry('com_rt_bookstore', '书店'),
          entry('com_rt_stationery', '文具店'),
          entry('com_rt_flower', '花店'),
          entry('com_rt_pet', '宠物店'),
          entry('com_rt_pharmacy', '药店'),
          entry('com_rt_optical', '眼镜店'),
          entry('com_rt_clothing', '服装店'),
          entry('com_rt_shoes', '鞋店'),
          entry('com_rt_jewelry', '珠宝店'),
          entry('com_rt_furniture', '家具店'),
          entry('com_rt_appliance', '电器店'),
        ],
      },
      {
        title: '餐饮',
        items: [
          entry('com_food_restaurant', '餐厅'),
          entry('com_food_fastfood', '快餐店'),
          entry('com_food_hotpot', '火锅店'),
          entry('com_food_bbq', '烧烤店'),
          entry('com_food_cafe', '咖啡店'),
          entry('com_food_milktea', '奶茶店'),
          entry('com_food_dessert', '甜品店'),
          entry('com_food_bakery', '面包店'),
          entry('com_food_bar', '酒吧'),
          entry('com_food_pub', '酒馆'),
          entry('com_food_tea', '茶馆'),
          entry('com_food_snack', '小吃摊'),
        ],
      },
      {
        title: '服务',
        items: [
          entry('com_svc_barber', '理发店'),
          entry('com_svc_beauty', '美容院'),
          entry('com_svc_nail', '美甲店'),
          entry('com_svc_gym', '健身房'),
          entry('com_svc_pool', '游泳馆'),
          entry('com_svc_bath', '洗浴中心'),
          entry('com_svc_hotel', '酒店'),
          entry('com_svc_inn', '旅馆'),
          entry('com_svc_hostel', '招待所'),
          entry('com_svc_bank', '银行'),
          entry('com_svc_atm', 'ATM 机'),
          entry('com_svc_post', '邮局'),
          entry('com_svc_express', '快递站'),
          entry('com_svc_laundry', '干洗店'),
          entry('com_svc_auto_repair', '修车行'),
          entry('com_svc_gas', '加油站'),
          entry('com_svc_car_wash', '洗车店'),
          entry('com_svc_photo', '照相馆'),
          entry('com_svc_print', '打印店'),
          entry('com_svc_agency', '中介公司'),
          entry('com_svc_travel', '旅行社'),
        ],
      },
    ],
  },
  {
    title: '工业与仓储',
    groups: [
      {
        title: '工厂',
        items: [
          entry('ind_fac_factory', '普通工厂'),
          entry('ind_fac_chemical', '化工厂'),
          entry('ind_fac_power', '发电厂'),
          entry('ind_fac_steel', '钢铁厂'),
          entry('ind_fac_food', '食品加工厂'),
          entry('ind_fac_textile', '纺织厂'),
          entry('ind_fac_electronics', '电子厂'),
        ],
      },
      {
        title: '仓储',
        items: [
          entry('ind_wh_warehouse', '仓库'),
          entry('ind_wh_logistics', '物流中心'),
          entry('ind_wh_cold', '冷库'),
          entry('ind_wh_container', '集装箱堆场'),
          entry('ind_wh_freight', '货运站'),
        ],
      },
      {
        title: '其他',
        items: [
          entry('ind_misc_parking', '停车场'),
          entry('ind_misc_garage', '车库'),
          entry('ind_misc_repair', '修理厂'),
          entry('ind_misc_scrap', '废品回收站'),
          entry('ind_misc_sewage', '污水处理厂'),
          entry('ind_misc_waste', '垃圾处理厂'),
        ],
      },
    ],
  },
  {
    title: '公共服务建筑',
    groups: [
      {
        title: '教育',
        items: [
          entry('pub_edu_kindergarten', '幼儿园'),
          entry('pub_edu_primary', '小学'),
          entry('pub_edu_middle', '中学'),
          entry('pub_edu_high', '大学'),
          entry('pub_edu_vocational', '职业学校'),
          entry('pub_edu_training', '培训机构'),
          entry('pub_edu_library', '图书馆'),
          entry('pub_edu_science', '科技馆'),
        ],
      },
      {
        title: '医疗',
        items: [
          entry('pub_med_hospital', '医院'),
          entry('pub_med_clinic', '诊所'),
          entry('pub_med_community', '社区卫生服务中心'),
          entry('pub_med_disease', '防疫站'),
          entry('pub_med_emergency', '急救中心'),
          entry('pub_med_pharmacy', '药店'),
        ],
      },
      {
        title: '政府',
        items: [
          entry('pub_gov_building', '政府大楼'),
          entry('pub_gov_police', '派出所'),
          entry('pub_gov_court', '法院'),
          entry('pub_gov_procuratorate', '检察院'),
          entry('pub_gov_tax', '税务局'),
          entry('pub_gov_aic', '工商局'),
          entry('pub_gov_fire', '消防站'),
          entry('pub_gov_police_hq', '警察局'),
          entry('pub_gov_prison', '监狱'),
        ],
      },
      {
        title: '文化体育',
        items: [
          entry('pub_culture_museum', '博物馆'),
          entry('pub_culture_art', '美术馆'),
          entry('pub_culture_exhibition', '展览馆'),
          entry('pub_culture_theater', '剧院'),
          entry('pub_culture_cinema', '电影院'),
          entry('pub_culture_concert', '音乐厅'),
          entry('pub_culture_stadium', '体育馆'),
          entry('pub_culture_arena', '体育场'),
          entry('pub_culture_swim', '游泳馆'),
          entry('pub_culture_convention', '会展中心'),
        ],
      },
      {
        title: '宗教',
        items: [
          entry('pub_rel_church', '教堂'),
          entry('pub_rel_temple', '寺庙'),
          entry('pub_rel_mosque', '清真寺'),
          entry('pub_rel_dao', '道观'),
        ],
      },
    ],
  },
  {
    title: '特殊建筑 · 交通 · 地标',
    groups: [
      {
        title: '交通',
        items: [
          entry('spl_tr_train', '火车站'),
          entry('spl_tr_bus_station', '汽车站'),
          entry('spl_tr_airport', '机场航站楼'),
          entry('spl_tr_port', '港口码头'),
          entry('spl_tr_metro', '地铁站'),
          entry('spl_tr_lrt', '轻轨站'),
          entry('spl_tr_bus_stop', '公交站'),
        ],
      },
      {
        title: '地标',
        items: [
          entry('spl_lm_tv_tower', '电视塔'),
          entry('spl_lm_bell', '钟楼'),
          entry('spl_lm_monument', '纪念碑'),
          entry('spl_lm_ferris', '摩天轮'),
          entry('spl_lm_revolving', '旋转餐厅'),
          entry('spl_lm_viewpoint', '观景台'),
        ],
      },
      {
        title: '其他',
        items: [
          entry('spl_misc_funeral', '殡仪馆'),
          entry('spl_misc_crematorium', '火葬场'),
          entry('spl_misc_cemetery', '公墓'),
          entry('spl_misc_nuclear', '核电站'),
          entry('spl_misc_substation', '变电站'),
          entry('spl_misc_cell_tower', '通信基站'),
          entry('spl_misc_water_tower', '水塔'),
        ],
      },
    ],
  },
  {
    title: '地貌',
    groups: [
      {
        title: '陆地',
        items: [
          entry('land_plain_grass', '草地'),
          entry('land_plain_farm', '农田'),
          entry('land_plain_wasteland', '荒地'),
          entry('land_plain_desert', '沙漠'),
          entry('land_plain_gobi', '戈壁'),
          entry('land_plain_steppe', '草原'),
          entry('land_plain_wetland', '湿地'),
          entry('land_plain_swamp', '沼泽'),
          entry('land_mtn_hill', '丘陵'),
          entry('land_mtn_mountain', '山地'),
          entry('land_mtn_range', '山脉'),
          entry('land_mtn_cliff', '悬崖'),
          entry('land_mtn_canyon', '峡谷'),
          entry('land_mtn_cave', '洞穴'),
          entry('land_mtn_volcano', '火山'),
          entry('land_other_plateau', '高原'),
          entry('land_other_basin', '盆地'),
          entry('land_other_dune', '沙丘'),
          entry('land_other_stone', '石林'),
          entry('land_other_glacier', '冰川'),
          entry('land_other_permafrost', '冻土'),
        ],
      },
      {
        title: '水体',
        items: [
          entry('water_nat_river', '河流'),
          entry('water_nat_stream', '溪流'),
          entry('water_nat_lake', '湖泊'),
          entry('water_nat_pond', '池塘'),
          entry('water_nat_ocean', '海洋'),
          entry('water_nat_bay', '海湾'),
          entry('water_nat_strait', '海峡'),
          entry('water_nat_waterfall', '瀑布'),
          entry('water_nat_spring', '泉眼'),
          entry('water_art_reservoir', '水库'),
          entry('water_art_canal', '运河'),
          entry('water_art_ditch', '水渠'),
          entry('water_art_moat', '护城河'),
          entry('water_art_lake', '人工湖'),
          entry('water_art_fountain', '喷泉'),
          entry('water_art_pool', '游泳池'),
        ],
      },
    ],
  },
  {
    title: '道路与桥梁',
    groups: [
      {
        title: '城市道路',
        items: [
          entry('road_city_sidewalk', '人行道'),
          entry('road_city_bike', '非机动车道'),
          entry('road_city_car', '机动车道'),
          entry('road_city_oneway', '单行道'),
          entry('road_city_twoway', '双行道'),
          entry('road_city_roundabout', '环岛'),
          entry('road_city_cross', '十字路口'),
          entry('road_city_tjunction', '丁字路口'),
          entry('road_city_flyover', '立交桥'),
          entry('road_city_elevated', '高架桥'),
          entry('road_city_tunnel', '隧道'),
        ],
      },
      {
        title: '公路',
        items: [
          entry('road_hw_normal', '普通公路'),
          entry('road_hw_national', '国道'),
          entry('road_hw_provincial', '省道'),
          entry('road_hw_express', '高速公路'),
          entry('road_hw_toll', '收费站'),
          entry('road_hw_service', '服务区'),
        ],
      },
      {
        title: '乡村道路',
        items: [
          entry('road_rural_dirt', '土路'),
          entry('road_rural_gravel', '砂石路'),
          entry('road_rural_cement', '水泥路'),
          entry('road_rural_asphalt', '柏油路'),
          entry('road_rural_field', '田间小路'),
        ],
      },
      {
        title: '特殊道路',
        items: [
          entry('road_sp_rail', '铁路'),
          entry('road_sp_lrt', '轻轨'),
          entry('road_sp_metro', '地铁轨道'),
          entry('road_sp_ped', '步行街'),
          entry('road_sp_bike', '自行车道'),
          entry('road_sp_horse', '马道'),
          entry('road_sp_runway', '跑道'),
        ],
      },
      {
        title: '桥梁',
        items: [
          entry('bridge_struct_beam', '梁桥'),
          entry('bridge_struct_arch', '拱桥'),
          entry('bridge_struct_cable', '斜拉桥'),
          entry('bridge_struct_suspension', '悬索桥'),
          entry('bridge_struct_truss', '钢架桥'),
          entry('bridge_use_road', '公路桥'),
          entry('bridge_use_rail', '铁路桥'),
          entry('bridge_use_ped', '人行桥'),
          entry('bridge_use_combo', '两用桥'),
          entry('bridge_use_elevated', '高架桥'),
          entry('bridge_other_culvert', '涵洞'),
          entry('bridge_other_tunnel', '隧道'),
          entry('bridge_other_underpass', '地下通道'),
          entry('bridge_other_footbridge', '过街天桥'),
        ],
      },
    ],
  },
  {
    title: '交通设施 · 地标装饰',
    groups: [
      {
        title: '停车与设施',
        items: [
          entry('traf_park_lot', '停车场'),
          entry('traf_park_space', '停车位'),
          entry('traf_park_under', '地下停车场'),
          entry('traf_park_multi', '立体停车场'),
          entry('traf_park_bike', '自行车棚'),
        ],
      },
      {
        title: '交通标志与标线',
        items: [
          entry('traf_sign_light', '红绿灯'),
          entry('traf_sign_signal', '交通信号灯'),
          entry('traf_sign_board', '指示牌'),
          entry('traf_sign_warn', '警示牌'),
          entry('traf_sign_speed', '限速牌'),
          entry('traf_sign_crosswalk', '斑马线'),
          entry('traf_sign_stopline', '停止线'),
          entry('traf_sign_yellow', '黄线'),
          entry('traf_sign_white', '白线'),
        ],
      },
      {
        title: '其他交通',
        items: [
          entry('traf_other_bus_shelter', '公交站台'),
          entry('traf_other_taxi', '出租车停靠点'),
          entry('traf_other_gas', '加油站'),
          entry('traf_other_charge', '充电桩'),
          entry('traf_other_toll', '收费站'),
          entry('traf_other_service', '服务区'),
          entry('traf_other_checkpoint', '检查站'),
          entry('traf_other_barrier', '路障'),
          entry('traf_other_guardrail', '护栏'),
          entry('traf_other_median', '隔离带'),
        ],
      },
      {
        title: '地标与装饰',
        items: [
          entry('lm_tv', '电视塔'),
          entry('lm_bell', '钟楼'),
          entry('lm_monument', '纪念碑'),
          entry('lm_ferris', '摩天轮'),
          entry('lm_restaurant', '旋转餐厅'),
          entry('lm_view', '观景台'),
          entry('dec_sculpt_figure', '人物雕塑'),
          entry('dec_sculpt_animal', '动物雕塑'),
          entry('dec_sculpt_abstract', '抽象雕塑'),
          entry('dec_sculpt_memorial', '纪念雕塑'),
          entry('dec_water_fountain', '喷泉'),
          entry('dec_water_lake', '人工湖'),
          entry('dec_water_fall', '瀑布'),
          entry('dec_water_stream', '溪流'),
          entry('dec_water_pond', '池塘'),
          entry('dec_land_rock', '假山'),
          entry('dec_land_flower', '花坛'),
          entry('dec_land_garden', '花园'),
          entry('dec_land_lawn', '草坪'),
          entry('dec_land_green', '绿化带'),
          entry('dec_land_trees', '行道树'),
        ],
      },
    ],
  },
  {
    title: '休闲 · 自然 · 区域',
    groups: [
      {
        title: '休闲娱乐',
        items: [
          entry('rec_park', '公园'),
          entry('rec_square', '广场'),
          entry('rec_amusement', '游乐园'),
          entry('rec_zoo', '动物园'),
          entry('rec_botanical', '植物园'),
          entry('rec_aquarium', '水族馆'),
          entry('rec_ski', '滑雪场'),
          entry('rec_ice', '溜冰场'),
          entry('rec_golf', '高尔夫球场'),
          entry('rec_tennis', '网球场'),
          entry('rec_basketball', '篮球场'),
          entry('rec_football', '足球场'),
        ],
      },
      {
        title: '自然保护区',
        items: [
          entry('nat_forest_park', '森林公园'),
          entry('nat_reserve', '自然保护区'),
          entry('nat_wetland_park', '湿地公园'),
          entry('nat_geo_park', '地质公园'),
        ],
      },
      {
        title: '功能分区',
        items: [
          entry('zone_military', '军事基地'),
          entry('zone_airport', '机场'),
          entry('zone_port', '港口'),
          entry('zone_rail', '火车站'),
          entry('zone_bus', '汽车站'),
          entry('zone_metro', '地铁站'),
          entry('zone_lrt', '轻轨站'),
          entry('zone_industrial', '工业区'),
          entry('zone_commercial', '商业区'),
          entry('zone_residential', '住宅区'),
          entry('zone_school', '学校区'),
          entry('zone_hospital', '医院区'),
          entry('zone_gov', '政府区'),
        ],
      },
    ],
  },
]

/** 扁平列表（兼容旧 TERRAIN_PRESETS 用法） */
export function flattenCatalogForPicker(): MapTerrainEntry[] {
  const out: MapTerrainEntry[] = []
  for (const sec of WORLD_MAP_CATALOG) {
    for (const g of sec.groups) {
      out.push(...g.items)
    }
  }
  return out
}
