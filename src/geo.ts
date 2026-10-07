/** Bundled gazetteer for search and popup context. */
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
