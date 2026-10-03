import type { LayerId } from "./layers";

export type Region =
  | "England"
  | "Scotland"
  | "Wales"
  | "Northern Ireland"
  | "Ireland"
  | "Crown dependency";

export interface Place {
  id: string;
  name: string;
  region: Region;
  lon: number;
  lat: number;
  pop: number;
}

interface Feature {
  type: "Feature";
  geometry:
    | { type: "Point"; coordinates: [number, number] }
    | { type: "LineString"; coordinates: [number, number][] };
  properties: Record<string, string | number | boolean>;
}

export interface FeatureCollection {
  type: "FeatureCollection";
  features: Feature[];
}

const PLACE_TABLE = `
london|London|England|-0.128|51.507|8900000
birmingham|Birmingham|England|-1.900|52.486|1140000
manchester|Manchester|England|-2.244|53.481|560000
leeds|Leeds|England|-1.549|53.801|500000
liverpool|Liverpool|England|-2.992|53.408|500000
sheffield|Sheffield|England|-1.470|53.381|560000
bristol|Bristol|England|-2.588|51.455|470000
newcastle|Newcastle|England|-1.613|54.978|300000
nottingham|Nottingham|England|-1.158|52.955|330000
leicester|Leicester|England|-1.133|52.636|370000
coventry|Coventry|England|-1.510|52.408|340000
bradford|Bradford|England|-1.759|53.796|340000
stoke|Stoke-on-Trent|England|-2.179|53.003|260000
wolverhampton|Wolverhampton|England|-2.128|52.587|260000
derby|Derby|England|-1.476|52.922|260000
southampton|Southampton|England|-1.404|50.910|250000
portsmouth|Portsmouth|England|-1.088|50.820|210000
plymouth|Plymouth|England|-4.143|50.376|260000
brighton|Brighton|England|-0.137|50.823|230000
reading|Reading|England|-0.978|51.454|175000
luton|Luton|England|-0.418|51.879|225000
northampton|Northampton|England|-0.902|52.240|230000
milton-keynes|Milton Keynes|England|-0.760|52.041|230000
oxford|Oxford|England|-1.257|51.752|160000
cambridge|Cambridge|England|0.121|52.205|150000
norwich|Norwich|England|1.297|52.630|200000
ipswich|Ipswich|England|1.155|52.056|140000
york|York|England|-1.080|53.960|210000
hull|Hull|England|-0.333|53.745|270000
middlesbrough|Middlesbrough|England|-1.235|54.574|140000
sunderland|Sunderland|England|-1.382|54.907|175000
durham|Durham|England|-1.575|54.776|50000
preston|Preston|England|-2.703|53.763|150000
lancaster|Lancaster|England|-2.801|54.047|53000
blackpool|Blackpool|England|-3.050|53.817|140000
bolton|Bolton|England|-2.429|53.578|180000
blackburn|Blackburn|England|-2.482|53.748|120000
warrington|Warrington|England|-2.587|53.390|170000
huddersfield|Huddersfield|England|-1.782|53.645|160000
doncaster|Doncaster|England|-1.131|53.523|160000
lincoln|Lincoln|England|-0.539|53.230|100000
scunthorpe|Scunthorpe|England|-0.650|53.591|82000
grimsby|Grimsby|England|-0.079|53.567|88000
peterborough|Peterborough|England|-0.241|52.573|200000
bedford|Bedford|England|-0.460|52.136|95000
stevenage|Stevenage|England|-0.202|51.902|90000
watford|Watford|England|-0.396|51.656|100000
slough|Slough|England|-0.595|51.511|160000
high-wycombe|High Wycombe|England|-0.748|51.629|120000
guildford|Guildford|England|-0.570|51.236|80000
crawley|Crawley|England|-0.187|51.109|110000
basingstoke|Basingstoke|England|-1.087|51.266|115000
winchester|Winchester|England|-1.308|51.063|50000
chichester|Chichester|England|-0.779|50.837|30000
worthing|Worthing|England|-0.371|50.818|110000
hastings|Hastings|England|0.576|50.855|92000
eastbourne|Eastbourne|England|0.284|50.768|103000
southend|Southend|England|0.710|51.545|180000
basildon|Basildon|England|0.489|51.576|115000
chelmsford|Chelmsford|England|0.469|51.736|180000
colchester|Colchester|England|0.892|51.896|130000
maidstone|Maidstone|England|0.523|51.272|115000
canterbury|Canterbury|England|1.080|51.280|55000
dover|Dover|England|1.313|51.127|32000
swindon|Swindon|England|-1.779|51.558|185000
bath|Bath|England|-2.360|51.381|100000
gloucester|Gloucester|England|-2.238|51.864|130000
cheltenham|Cheltenham|England|-2.078|51.900|116000
worcester|Worcester|England|-2.221|52.194|103000
hereford|Hereford|England|-2.715|52.056|61000
shrewsbury|Shrewsbury|England|-2.753|52.708|76000
telford|Telford|England|-2.447|52.678|155000
crewe|Crewe|England|-2.441|53.099|75000
chester|Chester|England|-2.892|53.191|90000
exeter|Exeter|England|-3.533|50.718|130000
taunton|Taunton|England|-3.101|51.015|65000
yeovil|Yeovil|England|-2.637|50.942|48000
torquay|Torquay|England|-3.525|50.462|65000
bournemouth|Bournemouth|England|-1.880|50.720|200000
poole|Poole|England|-1.988|50.715|150000
truro|Truro|England|-5.052|50.263|21000
penzance|Penzance|England|-5.537|50.119|21000
barnstaple|Barnstaple|England|-4.060|51.080|35000
carlisle|Carlisle|England|-2.933|54.895|75000
kendal|Kendal|England|-2.746|54.328|29000
penrith|Penrith|England|-2.755|54.664|16000
barrow|Barrow|England|-3.226|54.111|56000
harrogate|Harrogate|England|-1.541|53.992|76000
scarborough|Scarborough|England|-0.404|54.279|61000
kettering|Kettering|England|-0.726|52.398|62000
banbury|Banbury|England|-1.340|52.062|48000
stockport|Stockport|England|-2.149|53.410|140000
wigan|Wigan|England|-2.632|53.545|105000
halifax|Halifax|England|-1.860|53.725|90000
rotherham|Rotherham|England|-1.357|53.430|110000
barnsley|Barnsley|England|-1.482|53.553|91000
wakefield|Wakefield|England|-1.499|53.683|85000
mansfield|Mansfield|England|-1.189|53.144|80000
chesterfield|Chesterfield|England|-1.429|53.235|100000
darlington|Darlington|England|-1.553|54.526|95000
hartlepool|Hartlepool|England|-1.212|54.686|92000
kings-lynn|King's Lynn|England|0.399|52.752|46000
great-yarmouth|Great Yarmouth|England|1.728|52.608|40000
boston|Boston|England|-0.021|52.974|40000
newport-iow|Newport|England|-1.288|50.701|25000
ryde|Ryde|England|-1.163|50.730|24000
cardiff|Cardiff|Wales|-3.179|51.482|360000
swansea|Swansea|Wales|-3.944|51.621|240000
newport|Newport|Wales|-2.998|51.584|160000
wrexham|Wrexham|Wales|-2.993|53.046|65000
bangor|Bangor|Wales|-4.128|53.228|18000
holyhead|Holyhead|Wales|-4.633|53.309|12000
aberystwyth|Aberystwyth|Wales|-4.085|52.415|16000
caernarfon|Caernarfon|Wales|-4.277|53.139|10000
glasgow|Glasgow|Scotland|-4.252|55.864|630000
edinburgh|Edinburgh|Scotland|-3.188|55.953|530000
aberdeen|Aberdeen|Scotland|-2.094|57.150|230000
dundee|Dundee|Scotland|-2.971|56.462|150000
inverness|Inverness|Scotland|-4.224|57.478|48000
stirling|Stirling|Scotland|-3.936|56.116|38000
perth|Perth|Scotland|-3.437|56.395|47000
falkirk|Falkirk|Scotland|-3.784|56.001|36000
livingston|Livingston|Scotland|-3.522|55.883|57000
paisley|Paisley|Scotland|-4.424|55.845|77000
ayr|Ayr|Scotland|-4.629|55.459|46000
kilmarnock|Kilmarnock|Scotland|-4.495|55.611|46000
dumfries|Dumfries|Scotland|-3.605|55.070|33000
fort-william|Fort William|Scotland|-5.112|56.820|10000
oban|Oban|Scotland|-5.472|56.415|8500
portree|Portree|Scotland|-6.196|57.412|2500
wick|Wick|Scotland|-3.093|58.442|7000
thurso|Thurso|Scotland|-3.526|58.596|7500
kirkwall|Kirkwall|Scotland|-2.960|58.981|9000
lerwick|Lerwick|Scotland|-1.149|60.155|7000
stornoway|Stornoway|Scotland|-6.388|58.209|8000
belfast|Belfast|Northern Ireland|-5.930|54.597|340000
derry|Derry|Northern Ireland|-7.309|54.997|85000
lisburn|Lisburn|Northern Ireland|-6.043|54.510|50000
newry|Newry|Northern Ireland|-6.340|54.175|28000
craigavon|Craigavon|Northern Ireland|-6.388|54.447|65000
armagh|Armagh|Northern Ireland|-6.655|54.350|15000
omagh|Omagh|Northern Ireland|-7.309|54.597|20000
enniskillen|Enniskillen|Northern Ireland|-7.641|54.346|14000
coleraine|Coleraine|Northern Ireland|-6.668|55.133|24000
bangor-ni|Bangor|Northern Ireland|-5.669|54.653|62000
dublin|Dublin|Ireland|-6.260|53.350|1200000
cork|Cork|Ireland|-8.486|51.899|220000
limerick|Limerick|Ireland|-8.626|52.664|100000
galway|Galway|Ireland|-9.049|53.274|83000
waterford|Waterford|Ireland|-7.111|52.259|55000
drogheda|Drogheda|Ireland|-6.350|53.718|44000
dundalk|Dundalk|Ireland|-6.405|54.004|43000
swords|Swords|Ireland|-6.218|53.459|40000
bray|Bray|Ireland|-6.109|53.202|33000
naas|Naas|Ireland|-6.660|53.216|25000
portlaoise|Portlaoise|Ireland|-7.300|53.034|23000
athlone|Athlone|Ireland|-7.940|53.423|22000
mullingar|Mullingar|Ireland|-7.338|53.526|21000
kilkenny|Kilkenny|Ireland|-7.252|52.654|27000
wexford|Wexford|Ireland|-6.458|52.337|21000
wicklow|Wicklow|Ireland|-6.045|52.981|12000
carlow|Carlow|Ireland|-6.926|52.836|24000
clonmel|Clonmel|Ireland|-7.704|52.355|18000
tralee|Tralee|Ireland|-9.702|52.271|24000
killarney|Killarney|Ireland|-9.504|52.060|15000
mallow|Mallow|Ireland|-8.641|52.139|13000
nenagh|Nenagh|Ireland|-8.196|52.861|9000
ennis|Ennis|Ireland|-8.986|52.847|26000
castlebar|Castlebar|Ireland|-9.299|53.854|13000
sligo|Sligo|Ireland|-8.476|54.277|20000
letterkenny|Letterkenny|Ireland|-7.734|54.955|20000
douglas|Douglas|Crown dependency|-4.482|54.152|27000
st-helier|St Helier|Crown dependency|-2.107|49.188|34000
st-peter-port|St Peter Port|Crown dependency|-2.537|49.455|19000
`;

const ROAD_TABLE = `
M4|london > -0.48,51.49 > reading > swindon > -2.25,51.51 > bristol > newport > cardiff > -3.55,51.62 > swansea
M5|birmingham > worcester > gloucester > bristol > -2.85,51.28 > -3.01,51.13 > taunton > exeter > -3.7,50.48 > plymouth
A30|exeter > -3.85,50.72 > -4.25,50.64 > -4.72,50.47 > truro > penzance
M1|london > luton > milton-keynes > northampton > leicester > nottingham > -1.43,53.24 > sheffield > leeds
A1|leeds > york > -1.34,54.23 > darlington > durham > newcastle > -1.6,55.42 > -1.99,55.77 > -2.35,55.95 > edinburgh
M6|birmingham > -2.12,52.81 > stoke > -2.35,53.23 > warrington > preston > lancaster > kendal > penrith > carlisle
M62|liverpool > -2.7,53.45 > manchester > huddersfield > leeds > -0.85,53.74 > hull
M56|manchester > -2.5,53.35 > chester
A55|chester > -3.4,53.28 > -3.82,53.28 > bangor > holyhead
A49|chester > shrewsbury > hereford > -3.05,51.85 > newport
M40|london > high-wycombe > oxford > banbury > -1.53,52.29 > birmingham
M69|birmingham > coventry > leicester
A50|stoke > derby > nottingham
A46|leicester > lincoln
A15|lincoln > scunthorpe > hull
A57|sheffield > doncaster > -0.95,53.55 > hull
A64|leeds > york
Transpennine|manchester > sheffield
A580|liverpool > manchester
Blackpool spur|preston > blackpool
A69|carlisle > -2.2,54.95 > newcastle
M74|carlisle > -3.06,55.00 > -3.36,55.12 > -3.63,55.45 > -4.04,55.77 > glasgow
M8|edinburgh > livingston > glasgow
M80|glasgow > -4.02,56.00 > stirling
A9|edinburgh > falkirk > stirling > perth > -3.85,56.75 > -4.15,57.08 > inverness > -3.95,57.85 > wick > thurso
A90|perth > dundee > -2.45,56.72 > aberdeen
A96|aberdeen > -2.65,57.42 > -3.35,57.5 > inverness
A82|glasgow > -4.55,56.18 > -4.72,56.40 > -4.95,56.62 > fort-william > -4.72,56.95 > -4.45,57.18 > inverness
A85|fort-william > oban
A77|glasgow > kilmarnock > ayr
Skye|inverness > -4.72,57.28 > -5.25,57.28 > -5.72,57.28 > portree
M25|-0.52,51.48 > -0.50,51.33 > -0.22,51.31 > 0.05,51.34 > 0.24,51.42 > 0.27,51.55 > 0.15,51.64 > -0.06,51.68 > -0.32,51.67 > -0.51,51.60 > -0.55,51.50 > -0.52,51.48
A23|london > crawley > brighton
A27|brighton > worthing > chichester > portsmouth > southampton
M3|london > basingstoke > winchester > southampton
A31|southampton > bournemouth > -2.44,50.71 > -2.75,50.73 > exeter
A2|london > maidstone > canterbury > dover
A12|london > chelmsford > colchester > ipswich > norwich
A11|london > stevenage > cambridge > 0.45,52.36 > 0.90,52.50 > norwich
A14|cambridge > kettering > northampton
A127|london > basildon > southend
A303|basingstoke > -1.65,51.20 > -2.22,51.13 > yeovil > exeter
A417|gloucester > swindon
Heads of the Valleys|cardiff > -3.05,51.85 > hereford > worcester > birmingham
A44|shrewsbury > -3.43,52.52 > aberystwyth
North Wales link|bangor > caernarfon
M50|-6.18,53.39 > -6.24,53.32 > -6.36,53.29 > -6.43,53.34 > -6.38,53.40 > -6.27,53.42 > -6.18,53.40
M1 Ireland|dublin > swords > drogheda > dundalk > newry > craigavon > lisburn > belfast
A6|belfast > -6.25,54.75 > coleraine > -6.95,55.02 > derry
A5|belfast > lisburn > craigavon > armagh > omagh > derry
A4|omagh > enniskillen > -8.05,54.28 > sligo
M7|dublin > naas > portlaoise > -7.85,52.95 > nenagh > limerick
M8 Ireland|portlaoise > -7.75,52.68 > -8.15,52.35 > mallow > cork
M6 Ireland|dublin > mullingar > athlone > -8.45,53.38 > galway
M18|limerick > ennis > galway
N17|galway > castlebar > sligo
N15|sligo > -8.15,54.55 > letterkenny > derry
N21|limerick > -9.05,52.45 > tralee
N22|cork > killarney > tralee
N25|cork > -8.15,51.90 > waterford > wexford > wicklow > bray > dublin
M9 Ireland|dublin > naas > kilkenny > waterford
N24|limerick > clonmel > waterford
Isle of Wight|newport-iow > ryde
`;

const NAMED_POINTS: Record<string, string> = {
  cemeteries: `
Highgate Cemetery|London|-0.147|51.567
Glasnevin Cemetery|Dublin|-6.277|53.372
Brompton Cemetery|London|-0.191|51.485
Glasgow Necropolis|Glasgow|-4.231|55.862
Arnos Vale Cemetery|Bristol|-2.565|51.443
`,
  immigration: `
Heathrow preview|London|-0.454|51.470
Gatwick preview|Crawley|-0.182|51.153
Manchester Airport preview|Manchester|-2.275|53.354
Stansted preview|Stansted|0.235|51.886
Dublin Airport preview|Dublin|-6.270|53.426
Belfast International preview|Belfast|-6.216|54.658
Dover preview|Dover|1.340|51.127
Holyhead preview|Holyhead|-4.633|53.309
Rosslare preview|Rosslare|-6.341|52.251
Cairnryan preview|Cairnryan|-5.016|54.971
`,
  crime: `
Crime preview|London|-0.10|51.52
Crime preview|Birmingham|-1.90|52.49
Crime preview|Manchester|-2.24|53.48
Crime preview|Glasgow|-4.25|55.86
Crime preview|Cardiff|-3.18|51.48
Crime preview|Belfast|-5.93|54.60
Crime preview|Dublin|-6.26|53.35
Crime preview|Edinburgh|-3.19|55.95
`,
  health: `
Health preview|Leeds|-1.55|53.80
Health preview|Bristol|-2.59|51.45
Health preview|Liverpool|-2.99|53.41
Health preview|Newcastle|-1.61|54.98
Health preview|Aberdeen|-2.09|57.15
Health preview|Cork|-8.47|51.90
Health preview|Galway|-9.05|53.27
Health preview|Southampton|-1.40|50.91
`,
  weather: `
Heathrow station|London|-0.451|51.479
Eskdalemuir station|Eskdalemuir|-3.206|55.311
Lerwick station|Lerwick|-1.183|60.139
Valley station|Anglesey|-4.535|53.252
Aldergrove station|Aldergrove|-6.216|54.664
Shannon station|Shannon|-8.919|52.702
Aberdeen station|Aberdeen|-2.205|57.205
Valentia station|Valentia|-10.243|51.938
Malin Head station|Malin Head|-7.339|55.372
Camborne station|Camborne|-5.327|50.218
`,
  power: `
Drax|Drax|-0.996|53.737
Ratcliffe|Ratcliffe-on-Soar|-1.255|52.866
Pembroke Power|Pembroke|-4.991|51.684
Peterhead Power|Peterhead|-1.789|57.477
Moneypoint|Moneypoint|-9.424|52.607
Didcot|Didcot|-1.268|51.623
West Burton|West Burton|-0.810|53.361
Aghada|Aghada|-8.182|51.834
Kilroot|Kilroot|-5.767|54.725
Grain|Isle of Grain|0.714|51.444
`,
  nuclear: `
Hinkley Point|Hinkley|-3.128|51.209
Sizewell|Sizewell|1.620|52.215
Heysham|Heysham|-2.916|54.029
Torness|Torness|-2.408|55.968
Hunterston|Hunterston|-4.896|55.722
Hartlepool Nuclear|Hartlepool|-1.192|54.635
Dungeness|Dungeness|0.959|50.913
Wylfa|Wylfa|-4.483|53.416
Sellafield|Sellafield|-3.498|54.421
`,
  castles: `
Tower of London|London|-0.076|51.508
Windsor Castle|Windsor|-0.604|51.484
Edinburgh Castle|Edinburgh|-3.200|55.948
Stirling Castle|Stirling|-3.948|56.124
Caernarfon Castle|Caernarfon|-4.277|53.139
Conwy Castle|Conwy|-3.826|53.280
Warwick Castle|Warwick|-1.585|52.279
Dover Castle|Dover|1.325|51.129
Blarney Castle|Blarney|-8.571|51.929
Kilkenny Castle|Kilkenny|-7.249|52.650
Carrickfergus Castle|Carrickfergus|-5.806|54.713
Eilean Donan|Dornie|-5.516|57.274
Bunratty Castle|Bunratty|-8.812|52.697
Dunluce Castle|Dunluce|-6.578|55.211
`,
  historic: `
Stonehenge|Amesbury|-1.826|51.179
Roman Baths|Bath|-2.360|51.381
Giant's Causeway|Bushmills|-6.511|55.240
Newgrange|Boyne Valley|-6.475|53.694
Skara Brae|Sandwick|-3.340|59.049
Housesteads|Hadrian's Wall|-2.331|55.013
Canterbury Cathedral|Canterbury|1.083|51.280
Clonmacnoise|Shannonbridge|-7.986|53.326
Tintagel|Tintagel|-4.760|50.668
Skellig Michael|Skellig|-10.538|51.771
`,
  legends: `
Glastonbury|Glastonbury|-2.714|51.147
Loch Ness|Drumnadrochit|-4.424|57.322
Tintagel legend|Tintagel|-4.750|50.668
Giant's Causeway|Bushmills|-6.511|55.240
Newgrange|Boyne Valley|-6.475|53.694
Arthur's Seat|Edinburgh|-3.162|55.944
Croagh Patrick|Murrisk|-9.659|53.760
The Burren|Ballyvaughan|-9.150|53.050
`,
  mountains: `
Ben Nevis|Highland|-5.004|56.797
Ben Macdui|Cairngorms|-3.640|57.070
Snowdon|Eryri|-4.076|53.068
Scafell Pike|Cumbria|-3.212|54.454
Helvellyn|Cumbria|-3.017|54.527
Pen y Fan|Brecon|-3.436|51.884
Slieve Donard|Mourne|-5.920|54.180
Carrauntoohil|Kerry|-9.743|51.999
Lugnaquilla|Wicklow|-6.465|52.966
Goat Fell|Arran|-5.243|55.626
Croagh Patrick|Mayo|-9.659|53.760
`,
};

const WIND_FARMS: Array<[string, number, number]> = [
  ["London Array", 1.52, 51.62],
  ["Hornsea", 1.65, 53.88],
  ["Walney", -3.58, 54.07],
  ["Gwynt y Môr", -3.62, 53.49],
  ["Beatrice", -2.95, 58.12],
  ["Robin Rigg", -3.72, 54.76],
  ["Arklow Bank", -5.95, 52.79],
  ["Moray East", -2.55, 58.18],
];

function loadPlaces(table: string): Place[] {
  const places: Place[] = [];
  for (const line of table.trim().split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split("|").map((part) => part.trim());
    if (parts.length !== 6) throw new Error(`Bad place row: ${trimmed}`);
    const [id, name, region, lon, lat, pop] = parts;
    const place: Place = {
      id,
      name,
      region: region as Region,
      lon: Number(lon),
      lat: Number(lat),
      pop: Number(pop),
    };
    if (Number.isNaN(place.lon) || Number.isNaN(place.lat) || Number.isNaN(place.pop)) {
      throw new Error(`Bad place numbers: ${trimmed}`);
    }
    places.push(place);
  }
  return places;
}

export const PLACES: Place[] = loadPlaces(PLACE_TABLE);

const placeById = new Map(PLACES.map((place) => [place.id, place]));

function at(id: string): [number, number] {
  const place = placeById.get(id);
  if (!place) throw new Error(`Unknown place "${id}"`);
  return [place.lon, place.lat];
}

function loadRoads(table: string): Array<{ name: string; coords: [number, number][] }> {
  const roads: Array<{ name: string; coords: [number, number][] }> = [];
  for (const line of table.trim().split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const bar = trimmed.indexOf("|");
    if (bar < 0) throw new Error(`Bad road row: ${trimmed}`);
    const name = trimmed.slice(0, bar).trim();
    const coords = trimmed
      .slice(bar + 1)
      .split(">")
      .map((token) => {
        const value = token.trim();
        if (value.includes(",")) {
          const [lon, lat] = value.split(",").map(Number);
          if (Number.isNaN(lon) || Number.isNaN(lat)) throw new Error(`Bad coord in ${name}: ${value}`);
          return [lon, lat] as [number, number];
        }
        return at(value);
      });
    if (coords.length < 2) throw new Error(`Road ${name} is too short`);
    roads.push({ name, coords });
  }
  return roads;
}

const ROADS = loadRoads(ROAD_TABLE);

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFrom(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function collection(features: Feature[]): FeatureCollection {
  return { type: "FeatureCollection", features };
}

function point(
  lon: number,
  lat: number,
  properties: Record<string, string | number | boolean>,
): Feature {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lon, lat] },
    properties,
  };
}

interface ScatterRule {
  perMillion: number;
  minPop: number;
  max: number;
  nouns: string[];
}

const SCATTER: Record<string, ScatterRule> = {
  pubs: {
    perMillion: 6,
    minPop: 10000,
    max: 5,
    nouns: ["Red Lion", "Crown", "Royal Oak", "Anchor", "Swan", "George", "White Hart", "Railway"],
  },
  schools: {
    perMillion: 4,
    minPop: 14000,
    max: 3,
    nouns: ["Primary", "Academy", "High School", "College"],
  },
  churches: {
    perMillion: 3,
    minPop: 12000,
    max: 2,
    nouns: ["Parish Church", "Chapel", "Abbey"],
  },
  hospitals: {
    perMillion: 1.4,
    minPop: 80000,
    max: 3,
    nouns: ["General Hospital", "Royal Infirmary", "Community Hospital"],
  },
  mosques: {
    perMillion: 2,
    minPop: 180000,
    max: 2,
    nouns: ["Central Mosque", "Islamic Centre"],
  },
  "other-religious": {
    perMillion: 1.2,
    minPop: 280000,
    max: 1,
    nouns: ["Meeting House", "Temple", "Gurdwara"],
  },
};

function radiusFor(pop: number): number {
  if (pop > 2_000_000) return 0.34;
  if (pop > 700_000) return 0.2;
  if (pop > 250_000) return 0.11;
  if (pop > 80000) return 0.07;
  return 0.04;
}

function scatterLayer(id: string): Feature[] {
  const rule = SCATTER[id];
  if (!rule) return [];
  const features: Feature[] = [];
  for (const place of PLACES) {
    if (place.pop < rule.minPop) continue;
    const rand = mulberry32(seedFrom(`${id}:${place.id}`));
    const expected = Math.min(rule.max, (place.pop / 1_000_000) * rule.perMillion);
    const count = Math.min(rule.max, Math.max(1, Math.round(expected)));
    const radius = radiusFor(place.pop);
    for (let index = 0; index < count; index += 1) {
      const angle = rand() * Math.PI * 2;
      const distance = Math.sqrt(rand()) * radius;
      const lon = place.lon + distance * Math.cos(angle) / Math.cos((place.lat * Math.PI) / 180);
      const lat = place.lat + distance * Math.sin(angle);
      const noun = rule.nouns[index % rule.nouns.length];
      features.push(
        point(lon, lat, {
          name: `${place.name} ${noun}`,
          layer: id,
          note: `Preview stub · ${place.region}`,
        }),
      );
    }
  }
  return features;
}

function namedLayer(id: string, note: string): Feature[] {
  const table = NAMED_POINTS[id];
  if (!table) return [];
  return table
    .trim()
    .split("\n")
    .map((line) => {
      const [name, where, lon, lat] = line.split("|").map((part) => part.trim());
      return point(Number(lon), Number(lat), {
        name,
        layer: id,
        note: `${note} · ${where}`,
      });
    });
}

function windLayer(): Feature[] {
  const features: Feature[] = [];
  for (const [name, lon, lat] of WIND_FARMS) {
    const rand = mulberry32(seedFrom(name));
    for (let index = 0; index < 4; index += 1) {
      const angle = rand() * Math.PI * 2;
      const distance = Math.sqrt(rand()) * 0.08;
      features.push(
        point(
          lon + (distance * Math.cos(angle)) / Math.cos((lat * Math.PI) / 180),
          lat + distance * Math.sin(angle),
          {
            name: `${name} turbine`,
            layer: "wind",
            note: "Preview stub · wind area",
          },
        ),
      );
    }
  }
  return features;
}

function populationLayer(): Feature[] {
  return PLACES.map((place) =>
    point(place.lon, place.lat, {
      name: place.name,
      layer: "population",
      note: `Preview population disc · ${place.region}`,
      pop: place.pop,
      r: Math.round(Math.max(5, Math.min(32, Math.sqrt(place.pop) / 75)) * 10) / 10,
    }),
  );
}

function censusLayer(): Feature[] {
  return PLACES.filter((place) => place.pop >= 20000).map((place) =>
    point(place.lon, place.lat, {
      name: `${place.name} census`,
      layer: "census",
      note: `Preview census marker · ${place.region}`,
    }),
  );
}

function roadLayer(): Feature[] {
  return ROADS.map((road) => ({
    type: "Feature" as const,
    geometry: { type: "LineString" as const, coordinates: road.coords },
    properties: {
      name: road.name,
      layer: "roads",
      note: "Preview corridor, not a surveyed network",
    },
  }));
}

const builders: Record<LayerId, () => Feature[]> = {
  roads: roadLayer,
  pubs: () => scatterLayer("pubs"),
  schools: () => scatterLayer("schools"),
  libraries: () => [],
  universities: () => [],
  museums: () => [],
  "railway-stations": () => [],
  aerodromes: () => [],
  "ferry-terminals": () => [],
  marinas: () => [],
  zoos: () => [],
  theatres: () => [],
  battlefields: () => [],
  cinemas: () => [],
  stadiums: () => [],
  "theme-parks": () => [],
  viewpoints: () => [],
  "arts-centres": () => [],
  aquariums: () => [],
  piers: () => [],
  ruins: () => [],
  "golf-courses": () => [],
  galleries: () => [],
  marketplaces: () => [],
  "nature-reserves": () => [],
  "camp-sites": () => [],
  memorials: () => [],
  "sports-centres": () => [],
  "caravan-sites": () => [],
  "fitness-centres": () => [],
  "community-centres": () => [],
  "playgrounds": () => [],
  "beaches": () => [],
  "swimming-pools": () => [],
  pharmacies: () => [],
  townhalls: () => [],
  "places-of-worship": () => [],
  lighthouses: () => [],
  courthouses: () => [],
  nightclubs: () => [],
  windmills: () => [],
  prisons: () => [],
  clinics: () => [],
  dentists: () => [],
  constituencies: () => [],
  hospitals: () => [],
  "fire-stations": () => [],
  police: () => [],
  churches: () => scatterLayer("churches"),
  "post-offices": () => [],
  mosques: () => scatterLayer("mosques"),
  population: populationLayer,
  "other-religious": () => scatterLayer("other-religious"),
  census: censusLayer,
  petrol: () => [],
  ev: () => [],
  cemeteries: () => namedLayer("cemeteries", "Preview cemetery"),
  immigration: () => namedLayer("immigration", "Preview checkpoint"),
  crime: () => namedLayer("crime", "Preview only, not an offence record"),
  health: () => namedLayer("health", "Preview health marker"),
  weather: () => namedLayer("weather", "Preview weather station"),
  power: () => [],
  wind: windLayer,
  nuclear: () => namedLayer("nuclear", "Preview nuclear site"),
  castles: () => [],
  historic: () => namedLayer("historic", "Preview historic site"),
  legends: () => namedLayer("legends", "Preview legend"),
  mountains: () => namedLayer("mountains", "Preview summit"),
};

export function buildCollection(id: LayerId): FeatureCollection {
  return collection(builders[id]());
}

export function searchPlaces(query: string): Place[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return PLACES.filter((place) => place.name.toLowerCase().includes(q) || place.id.includes(q))
    .sort((a, b) => {
      const rank = (place: Place) => {
        const name = place.name.toLowerCase();
        if (name === q) return 0;
        if (name.startsWith(q)) return 1;
        return 2;
      };
      const byRank = rank(a) - rank(b);
      if (byRank !== 0) return byRank;
      return b.pop - a.pop;
    })
    .slice(0, 6);
}
