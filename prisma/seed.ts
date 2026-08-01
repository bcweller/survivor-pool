import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ESPN's numeric team IDs + abbreviations. Logo URLs follow ESPN's public CDN
// pattern (https://a.espncdn.com/i/teamlogos/nfl/500/{abbr}.png). The score-sync
// job also refreshes name/logo from ESPN's live API, so this seed is just a
// sane starting point.
const TEAMS = [
  { espnId: '1',  abbreviation: 'atl', name: 'Falcons',     city: 'Atlanta',       conference: 'NFC', division: 'South', primaryColor: '#A71930', secondaryColor: '#000000' },
  { espnId: '2',  abbreviation: 'buf', name: 'Bills',       city: 'Buffalo',       conference: 'AFC', division: 'East',  primaryColor: '#00338D', secondaryColor: '#C60C30' },
  { espnId: '3',  abbreviation: 'chi', name: 'Bears',       city: 'Chicago',       conference: 'NFC', division: 'North', primaryColor: '#0B162A', secondaryColor: '#C83803' },
  { espnId: '4',  abbreviation: 'cin', name: 'Bengals',     city: 'Cincinnati',    conference: 'AFC', division: 'North', primaryColor: '#FB4F14', secondaryColor: '#000000' },
  { espnId: '5',  abbreviation: 'cle', name: 'Browns',      city: 'Cleveland',     conference: 'AFC', division: 'North', primaryColor: '#311D00', secondaryColor: '#FF3C00' },
  { espnId: '6',  abbreviation: 'dal', name: 'Cowboys',     city: 'Dallas',        conference: 'NFC', division: 'East',  primaryColor: '#003594', secondaryColor: '#869397' },
  { espnId: '7',  abbreviation: 'den', name: 'Broncos',     city: 'Denver',        conference: 'AFC', division: 'West',  primaryColor: '#FB4F14', secondaryColor: '#002244' },
  { espnId: '8',  abbreviation: 'det', name: 'Lions',       city: 'Detroit',       conference: 'NFC', division: 'North', primaryColor: '#0076B6', secondaryColor: '#B0B7BC' },
  { espnId: '9',  abbreviation: 'gb',  name: 'Packers',     city: 'Green Bay',     conference: 'NFC', division: 'North', primaryColor: '#203731', secondaryColor: '#FFB612' },
  { espnId: '10', abbreviation: 'ten', name: 'Titans',      city: 'Tennessee',     conference: 'AFC', division: 'South', primaryColor: '#0C2340', secondaryColor: '#4B92DB' },
  { espnId: '11', abbreviation: 'ind', name: 'Colts',       city: 'Indianapolis',  conference: 'AFC', division: 'South', primaryColor: '#002C5F', secondaryColor: '#A2AAAD' },
  { espnId: '12', abbreviation: 'kc',  name: 'Chiefs',      city: 'Kansas City',   conference: 'AFC', division: 'West',  primaryColor: '#E31837', secondaryColor: '#FFB81C' },
  { espnId: '13', abbreviation: 'lv',  name: 'Raiders',     city: 'Las Vegas',     conference: 'AFC', division: 'West',  primaryColor: '#000000', secondaryColor: '#A5ACAF' },
  { espnId: '14', abbreviation: 'lar', name: 'Rams',        city: 'Los Angeles',   conference: 'NFC', division: 'West',  primaryColor: '#003594', secondaryColor: '#FFA300' },
  { espnId: '15', abbreviation: 'mia', name: 'Dolphins',    city: 'Miami',         conference: 'AFC', division: 'East',  primaryColor: '#008E97', secondaryColor: '#FC4C02' },
  { espnId: '16', abbreviation: 'min', name: 'Vikings',     city: 'Minnesota',     conference: 'NFC', division: 'North', primaryColor: '#4F2683', secondaryColor: '#FFC62F' },
  { espnId: '17', abbreviation: 'ne',  name: 'Patriots',    city: 'New England',   conference: 'AFC', division: 'East',  primaryColor: '#002244', secondaryColor: '#C60C30' },
  { espnId: '18', abbreviation: 'no',  name: 'Saints',      city: 'New Orleans',   conference: 'NFC', division: 'South', primaryColor: '#D3BC8D', secondaryColor: '#101820' },
  { espnId: '19', abbreviation: 'nyg', name: 'Giants',      city: 'New York',      conference: 'NFC', division: 'East',  primaryColor: '#0B2265', secondaryColor: '#A71930' },
  { espnId: '20', abbreviation: 'nyj', name: 'Jets',        city: 'New York',      conference: 'AFC', division: 'East',  primaryColor: '#125740', secondaryColor: '#000000' },
  { espnId: '21', abbreviation: 'phi', name: 'Eagles',      city: 'Philadelphia',  conference: 'NFC', division: 'East',  primaryColor: '#004C54', secondaryColor: '#A5ACAF' },
  { espnId: '22', abbreviation: 'ari', name: 'Cardinals',   city: 'Arizona',       conference: 'NFC', division: 'West',  primaryColor: '#97233F', secondaryColor: '#000000' },
  { espnId: '23', abbreviation: 'pit', name: 'Steelers',    city: 'Pittsburgh',    conference: 'AFC', division: 'North', primaryColor: '#FFB612', secondaryColor: '#101820' },
  { espnId: '24', abbreviation: 'lac', name: 'Chargers',    city: 'Los Angeles',   conference: 'AFC', division: 'West',  primaryColor: '#0080C6', secondaryColor: '#FFC20E' },
  { espnId: '25', abbreviation: 'sf',  name: '49ers',       city: 'San Francisco', conference: 'NFC', division: 'West',  primaryColor: '#AA0000', secondaryColor: '#B3995D' },
  { espnId: '26', abbreviation: 'sea', name: 'Seahawks',    city: 'Seattle',       conference: 'NFC', division: 'West',  primaryColor: '#002244', secondaryColor: '#69BE28' },
  { espnId: '27', abbreviation: 'tb',  name: 'Buccaneers',  city: 'Tampa Bay',     conference: 'NFC', division: 'South', primaryColor: '#D50A0A', secondaryColor: '#34302B' },
  { espnId: '28', abbreviation: 'wsh', name: 'Commanders',  city: 'Washington',    conference: 'NFC', division: 'East',  primaryColor: '#5A1414', secondaryColor: '#FFB612' },
  { espnId: '29', abbreviation: 'car', name: 'Panthers',    city: 'Carolina',      conference: 'NFC', division: 'South', primaryColor: '#0085CA', secondaryColor: '#101820' },
  { espnId: '30', abbreviation: 'jax', name: 'Jaguars',     city: 'Jacksonville',  conference: 'AFC', division: 'South', primaryColor: '#101820', secondaryColor: '#D7A22A' },
  { espnId: '33', abbreviation: 'bal', name: 'Ravens',      city: 'Baltimore',     conference: 'AFC', division: 'North', primaryColor: '#241773', secondaryColor: '#000000' },
  { espnId: '34', abbreviation: 'hou', name: 'Texans',      city: 'Houston',       conference: 'AFC', division: 'South', primaryColor: '#03202F', secondaryColor: '#A71930' },
]

async function main() {
  for (const t of TEAMS) {
    await prisma.team.upsert({
      where: { espnId: t.espnId },
      update: {
        abbreviation: t.abbreviation,
        name: t.name,
        city: t.city,
        conference: t.conference,
        division: t.division,
        primaryColor: t.primaryColor,
        secondaryColor: t.secondaryColor,
        logoUrl: `https://a.espncdn.com/i/teamlogos/nfl/500/${t.abbreviation}.png`,
      },
      create: {
        espnId: t.espnId,
        abbreviation: t.abbreviation,
        name: t.name,
        city: t.city,
        conference: t.conference,
        division: t.division,
        primaryColor: t.primaryColor,
        secondaryColor: t.secondaryColor,
        logoUrl: `https://a.espncdn.com/i/teamlogos/nfl/500/${t.abbreviation}.png`,
      },
    })
  }
  console.log(`Seeded ${TEAMS.length} NFL teams.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
