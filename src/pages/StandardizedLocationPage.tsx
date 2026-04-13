import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, Star } from 'lucide-react';
import { getStandardizedLocation, StandardizedAppraiser, StandardizedLocation } from '../utils/standardizedData';
import { SEO } from '../components/SEO';
import { generateLocationSchema } from '../utils/schemaGenerators';
import { SITE_URL, buildSiteUrl, getPrimaryCtaUrl } from '../config/site';
import {
  hasPlaceholderName,
  isPlaceholderAbout,
  isTemplatedExperience,
  isTemplatedNotes,
  isTemplatedPricing
} from '../utils/dataQuality';
import { trackEvent } from '../utils/analytics';
import { cities as directoryCities } from '../data/cities.json';
import { DEFAULT_PLACEHOLDER_IMAGE } from '../config/assets';
import { normalizeAssetUrl } from '../utils/assetUrls';

type DirectoryCity = {
  name: string;
  state: string;
  slug: string;
  latitude?: number;
  longitude?: number;
};

const STRIKING_DISTANCE_CITY_SLUGS = [
  'des-moines',
  'kansas-city',
  'chicago',
  'columbus',
  'tucson',
  'denver',
  'milwaukee',
  'cleveland',
  'cincinnati',
  'baltimore',
  'louisville',
  'ottawa',
  'orlando',
  'san-antonio',
  'calgary',
  'austin',
  'honolulu',
  'minneapolis',
  'indianapolis',
  'edmonton',
  'seattle',
  'sacramento',
  'philadelphia',
  'oklahoma-city',
  'new-york',
  'toronto',
  'wichita',
  'las-vegas',
  'jacksonville',
  'pittsburgh',
  'tampa',
  'richmond',
  'new-orleans'
] as const;

const LOW_CTR_PRIORITY_CITY_SLUGS = [
  'aspen',
  'baltimore',
  'chicago',
  'cleveland',
  'columbus',
  'des-moines',
  'denver',
  'honolulu',
  'indianapolis',
  'jacksonville',
  'kansas-city',
  'milwaukee',
  'orlando',
  'philadelphia',
  'richmond',
  'seattle',
  'tucson',
] as const;

type LocationSeoOverride = {
  title: string;
  description: string;
  h1: string;
  heroDescription: string;
};

type LocationGuideContent = {
  marketOverview: string;
  commonItems: string;
  localScene: string;
  appraisalTips: string;
};

const LOCATION_GUIDE_CONTENT: Partial<
  Record<(typeof STRIKING_DISTANCE_CITY_SLUGS)[number], LocationGuideContent>
> = {
  'des-moines': {
    marketOverview:
      'Des Moines has a growing antique market driven by Iowa\'s agricultural heritage and historic settlement patterns. Estate sales throughout Polk County frequently feature mid-century farm tools, vintage advertising, and prairie-era furniture. The city\'s position as Iowa\'s capital means many government-era estates enter the market each year.',
    commonItems:
      'The most commonly appraised items in Des Moines include vintage John Deere collectibles, Iowa pottery (particularly Red Wing and McCoy pieces found at estate sales), mid-century modern furniture from the 1950s–60s suburban expansion, and Civil War-era artifacts from Iowa regiments. Quilt collections and folk art from rural Iowa communities also appear regularly.',
    localScene:
      'The Des Moines antique scene centers around the Historic East Village shops, the Fort Dodge antique district, and the weekly estate sales circuit. The Iowa State Fair antique shows (August) and the Des Moines Antique Dealers Association events draw collectors from across the Midwest. Local auction houses like Speer Auction and Pogue Auction handle significant estate consignments.',
    appraisalTips:
      'When getting an antique appraisal in Des Moines, focus on finding an appraiser familiar with Midwestern folk art and agricultural collectibles — these categories are undervalued by appraisers who primarily work on coastal markets. For Iowa pottery and Red Wing pieces, condition and original markings dramatically affect value. If you inherited a rural Iowa estate, expect to find items that may not appear in standard price guides but have strong regional collector demand.'
  },
  chicago: {
    marketOverview:
      'Chicago is one of the largest antique markets in the United States, with a century-old tradition of furniture manufacturing, architectural salvage, and immigrant artisan crafts. The city\'s history as a rail and shipping hub means estates here often contain pieces from across the country and abroad.',
    commonItems:
      'Chicago estates frequently contain Arts and Crafts furniture (particularly from the Roycroft and Stickley workshops), Chicago School architectural elements, WPA-era art, and immigrant folk art from Eastern European communities. Mid-century modern pieces from local manufacturers like Dunbar Furniture and vintage pieces from the Merchandise Mart era are also common finds.',
    localScene:
      'The Chicago antique scene is anchored by the West Randolph Street gallery district, the Kane County Flea Market (one of the largest in the Midwest), and the annual Chicago Antiques + Art + Design Show. Notable auction houses include Leslie Hindman Auctioneers (now Hindman) and Wright Auction, both of which set national price benchmarks for decorative arts.',
    appraisalTips:
      'Chicago appraisers tend to have deep expertise in Arts and Crafts furniture and Prairie School design — if your items fall in these categories, local specialists will provide more accurate valuations than generalists. For WPA-era art and Chicago School pieces, provenance documentation is critical. The city\'s large immigrant communities also mean that Eastern European and Scandinavian antiques often surface in estates and may carry premiums from diaspora collectors.'
  },
  milwaukee: {
    marketOverview:
      'Milwaukee\'s antique market reflects its German heritage, brewing industry history, and strong manufacturing tradition. Estate sales in the greater Milwaukee area frequently feature European imports, brewery memorabilia, and high-quality American-made furniture from the region\'s industrial era.',
    commonItems:
      'Commonly appraised items in Milwaukee include German and Bohemian glassware, vintage brewery advertising (Pabst, Schlitz, Miller), Steinway and local piano makers\' instruments, and German immigrant furniture from the 19th century. Wisconsin folk art, including fraktur and woodcarvings from German communities, also appears regularly.',
    localScene:
      'The Milwaukee antique circuit includes the Milwaukee Public Museum\'s occasional estate auctions, the West Allis Antique Market, and the annual Milwaukee Antiques Show. The city\'s proximity to German-American communities in Wisconsin and Minnesota creates a specialized collector base for European decorative arts.',
    appraisalTips:
      'Milwaukee appraisers with German-language skills and knowledge of European maker\'s marks will provide significantly better valuations for German and Bohemian pieces. Brewery memorabilia values have surged in the last decade — items that were considered common in the 1990s now command serious collector prices. For Wisconsin folk art, look for appraisers who understand the regional provenance networks.'
  },
  columbus: {
    marketOverview:
      'Columbus and central Ohio sit at the crossroads of Appalachian folk art traditions and Ohio\'s early industrial manufacturing heritage. The region\'s antique market is characterized by a mix of rural estate finds and items from Ohio\'s once-thriving pottery and glass industries.',
    commonItems:
      'Ohio art pottery (Rookwood, Roseville, Weller, and McCoy) is the most commonly appraised category in Columbus, followed by Appalachian folk art, Shaker furniture from nearby communities, and early American pressed glass from Ohio factories. Civil War artifacts from Ohio regiments and vintage advertising from Columbus-based companies also appear frequently.',
    localScene:
      'Columbus\'s antique scene includes the Round Table Antique Show, the Brimfield Antique Flea Markets (a short drive east), and numerous estate sale companies serving central Ohio. The Ohio History Connection and local historical societies provide provenance resources for regional pieces.',
    appraisalTips:
      'For Ohio art pottery, condition and glaze pattern are the primary value drivers — even minor crazing can reduce values by 50% or more. Columbus-area appraisers familiar with the Roseville and Weller pattern books will provide the most accurate valuations. Appalachian folk art from southern Ohio is an emerging category; appraisers with folk art specialization will capture values that generalists miss.'
  },
  cleveland: {
    marketOverview:
      'Cleveland\'s antique market benefits from the city\'s history as an industrial powerhouse and its wealthy Gilded Age families who built significant art and decorative arts collections. The greater Cleveland area has a strong tradition of European decorative arts and American studio pottery.',
    commonItems:
      'Cleveland estates commonly feature European porcelain (Meissen, Sèvres, Royal Vienna), American studio pottery from the Cleveland School, Gilded Age furniture from the Euclid Avenue mansions era, and industrial artifacts from the city\'s manufacturing past. The Cleveland Museum of Art\'s influence has also created a sophisticated local collector base for fine art prints and paintings.',
    localScene:
      'The Cleveland antique circuit includes the Cleveland Antiques Show, the monthly Brimfield-adjacent markets, and estate sales in the Shaker Heights and Cleveland Heights neighborhoods. Local auction houses handle significant European decorative arts consignments.',
    appraisalTips:
      'Cleveland appraisers tend to have strong European porcelain expertise due to the city\'s collector history. For American studio pottery, the Cleveland School pieces (particularly from Cowan Pottery) can command premium prices from institutional collectors. Industrial artifacts from Cleveland\'s manufacturing era are an undervalued category that may see appreciation as industrial heritage collecting grows.'
  },
  denver: {
    marketOverview:
      'Denver\'s antique market reflects the city\'s Wild West heritage, mining boom history, and rapid modern growth. The region\'s estates often contain Western Americana, Native American artifacts, and pieces from the mining and railroad eras that built Colorado.',
    commonItems:
      'The most commonly appraised items in Denver include Western furniture and decor (trapper\'s cabin pieces, mining equipment, railroadiana), Native American pottery and jewelry from Southwest tribes, Charles Russell and Frederic Remington prints and bronzes, and Victorian-era pieces from Denver\'s founding families. Mid-century modern pieces from the post-WWII Denver expansion are also increasingly common.',
    localScene:
      'Denver\'s antique scene includes the Denver Antique Show, the monthly 1st Friday gallery walks in the RiNo district, and the Colorado Antique Show at the National Western Complex. The city\'s proximity to mining towns and ranch communities means estate sales in the surrounding mountains frequently yield significant Western Americana.',
    appraisalTips:
      'For Western Americana, provenance and condition are paramount — items with documented connections to specific mining camps, ranches, or historical figures carry significant premiums. Native American pieces require appraisers who understand tribal attribution and can distinguish between period pieces and modern reproductions. Denver appraisers with Western art specialization will provide more accurate valuations for Russell, Remington, and local Colorado artists.'
  },
  tucson: {
    marketOverview:
      'Tucson\'s antique market is shaped by its Spanish colonial heritage, Native American traditions, and the influx of retirees bringing collections from across the country. The city\'s dry climate has preserved items that would deteriorate in more humid regions.',
    commonItems:
      'Tucson estates frequently contain Native American pottery and jewelry (particularly from Tohono O\'odham, Hopi, and Navajo artisans), Spanish colonial furniture and religious artifacts (santos, retablos), vintage Western wear and saddlery, and mid-century modern pieces brought by snowbird retirees. Petroglyph rubbings and Southwest photography are also common finds.',
    localScene:
      'Tucson\'s antique scene includes the Tucson Antique Mall, the monthly Fourth Avenue street fair, and the significant estate sale market driven by the city\'s large retiree population. The Tucson Gem & Mineral Show (February) creates a seasonal surge in mineral and lapidary collectible values.',
    appraisalTips:
      'For Native American pieces, tribal attribution and period identification are critical — Hopi overlay silverwork, Navajo turquoise jewelry, and Tohono O\'odham basketry each have distinct value drivers. Spanish colonial santos and retablos require appraisers who understand New Mexican and Mexican folk art traditions. The Tucson gem show season (February) is the best time to get mineral and lapidary items appraised, as specialist appraisers are in town.'
  },
  baltimore: {
    marketOverview:
      'Baltimore\'s antique market reflects its status as one of America\'s oldest cities, with centuries of accumulated wealth, maritime trade, and manufacturing. The region\'s estates contain pieces from the colonial era through the city\'s industrial peak.',
    commonItems:
      'Baltimore estates commonly feature Maryland furniture (particularly Baltimore card tables and secretary desks), Chesapeake Bay maritime artifacts, American silver from Baltimore silversmiths, and Federal-period decorative arts. The city\'s role as a major port means Asian export porcelain and European imports also appear regularly.',
    localScene:
      'Baltimore\'s antique scene includes the Baltimore Antique Show, the Elkton Antique Market, and estate sales in the historic neighborhoods of Federal Hill, Mount Vernon, and Roland Park. The Baltimore Museum of Art and the Maryland Historical Society provide provenance resources for regional pieces.',
    appraisalTips:
      'Baltimore furniture from the Federal period (1790–1820) is among the most valuable American furniture categories — pieces with Baltimore provenance can command 2–3x the value of similar pieces from other regions. For Chesapeake Bay maritime items, look for appraisers who understand the regional boat-building and oystering heritage. Maryland silver from makers like William Hollins and Samuel Kirk carries significant institutional collector demand.'
  },
  louisville: {
    marketOverview:
      'Louisville\'s antique market is deeply connected to Kentucky\'s bourbon heritage, horse racing culture, and Southern antiques traditions. The region\'s estates often contain pieces that reflect the state\'s agricultural wealth and social history.',
    commonItems:
      'Commonly appraised items in Louisville include Kentucky bourbon memorabilia and advertising, Thoroughbred racing collectibles, Southern furniture (particularly Kentucky-made pieces from the 18th and 19th centuries), and African American folk art from the region. Vintage Derby Day items, equestrian equipment, and Southern silver are also frequent finds.',
    localScene:
      'Louisville\'s antique scene includes the Louisville Antique Mall, the annual Louisville Antiques Show, and estate sales throughout Jefferson County and the surrounding Bluegrass region. The Kentucky Derby Museum and local historical societies provide context for racing-related collectibles.',
    appraisalTips:
      'For Kentucky bourbon memorabilia, pre-Prohibition items (before 1920) carry the highest premiums. Southern furniture from Kentucky makers is an underappreciated category — pieces from Louisville and Lexington cabinetmakers often rival the quality of more famous Philadelphia and New York makers. For Thoroughbred collectibles, provenance connecting items to specific horses, trainers, or farms dramatically affects value.'
  },
  'san-antonio': {
    marketOverview:
      'San Antonio\'s antique market is shaped by its unique blend of Spanish colonial, Mexican, and Texan heritage. The city\'s long history as a cultural crossroads means estates here contain items rarely found elsewhere in the United States.',
    commonItems:
      'San Antonio estates frequently feature Mexican colonial furniture and religious art (retablos, bultos), Texas Ranger and military memorabilia from Fort Sam Houston, vintage Western and ranch items, and Spanish colonial coins and silver. The city\'s German immigrant heritage also means European pieces, particularly from the Texas Hill Country German communities, appear regularly.',
    localScene:
      'San Antonio\'s antique scene includes the San Antonio Antique Market, the monthly First Friday art walk in the King William Historic District, and estate sales throughout the city\'s historic neighborhoods. The city\'s proximity to the Mexican border creates a unique market for Mexican folk art and colonial pieces.',
    appraisalTips:
      'For Mexican colonial pieces, look for appraisers who understand the distinction between period colonial items (pre-1821) and later reproductions. Texas military memorabilia from the Alamo era, Republic of Texas period, and Fort Sam Houston history carry significant premiums from institutional collectors. Spanish colonial silver from Mexican mints requires specialist knowledge to authenticate and value accurately.'
  },
  'kansas-city': {
    marketOverview:
      'Kansas City\'s antique market sits at the heart of America\'s agricultural and cattle-ranching heritage. The region\'s estates frequently contain pieces from the westward expansion era, early 20th-century farmsteads, and the city\'s jazz-age prosperity period. The Missouri-Kansas border history adds unique provenance to many regional finds.',
    commonItems:
      'The most commonly appraised items in Kansas City include Western ranch equipment and decorative arts, American prairie furniture, vintage advertising from Kansas City\'s once-thriving manufacturing sector, and jazz-era memorabilia from the 18th & Vine district. Native American trade items from Plains tribes and early Missouri Territory artifacts also appear regularly.',
    localScene:
      'Kansas City\'s antique scene includes the Crossroads Arts District galleries, the monthly antique markets at the Kansas City Antique Dealers Association, and the significant estate sale circuit serving Johnson County and the surrounding suburbs. The city\'s position between agricultural Kansas and urban Missouri creates a diverse inventory.',
    appraisalTips:
      'For Western and prairie-era items, Kansas City appraisers with regional expertise will capture values that coastal generalists miss. Jazz-era memorabilia from Kansas City\'s golden age (1920s–1940s) has appreciated significantly — items with connections to specific clubs or musicians carry premiums. For Native American Plains trade items, provenance documentation is critical.'
  },
  cincinnati: {
    marketOverview:
      'Cincinnati\'s antique market reflects its history as one of America\'s first great inland cities, with roots in the Ohio River trade, German immigration, and the pork-packing industry that earned it the nickname "Porkopolis." The region\'s estates contain items from over two centuries of accumulated wealth.',
    commonItems:
      'Cincinnati estates commonly feature Rookwood Pottery (founded in Cincinnati in 1880), Ohio River Valley furniture, German immigrant decorative arts, and vintage advertising from Cincinnati\'s brewing and manufacturing industries. Civil War artifacts from Ohio regiments and early American pressed glass from regional factories also appear frequently.',
    localScene:
      'Cincinnati\'s antique circuit includes the Findlay Market area shops, the monthly Brimfield-adjacent markets, and estate sales throughout Hamilton County. The Cincinnati Art Museum and local historical societies provide provenance resources for regional pieces, particularly Rookwood Pottery.',
    appraisalTips:
      'Rookwood Pottery is Cincinnati\'s most significant antique category — pieces with original marks and documented patterns can command substantial premiums. Cincinnati appraisers with Rookwood specialization will provide the most accurate valuations. For Ohio River Valley furniture, look for appraisers who understand the regional cabinetmaking traditions that blended Eastern and Appalachian styles.'
  },
  ottawa: {
    marketOverview:
      'Ottawa\'s antique market reflects Canada\'s political heritage, French-English cultural duality, and the city\'s history as a lumber and government town. Estates in the National Capital Region frequently contain pieces from the Confederation era and the early days of Canadian federalism.',
    commonItems:
      'Commonly appraised items in Ottawa include Canadiana furniture, Quebec folk art, Hudson\'s Bay Company memorabilia, and military artifacts from the Canadian regiments stationed in the capital. Victorian-era pieces from Ottawa\'s founding families and Indigenous crafts from the Ottawa River Valley also appear regularly.',
    localScene:
      'Ottawa\'s antique scene includes the ByWard Market area shops, the monthly Ottawa Antique Show, and estate sales throughout the National Capital Region. The Canadian Museum of History (across the river in Gatineau) and the National Archives provide provenance resources for Canadian historical pieces.',
    appraisalTips:
      'For Canadiana pieces, look for appraisers who understand the distinction between French-Canadian and English-Canadian decorative arts traditions — these carry different collector bases and value drivers. Hudson\'s Bay Company memorabilia has a dedicated collector network in Canada. Military artifacts from Canadian regiments require specialist knowledge of Canadian military history.'
  },
  orlando: {
    marketOverview:
      'Orlando\'s antique market is shaped by Florida\'s land boom era, citrus industry history, and the influx of retirees bringing collections from across the country. The region\'s estates contain a unique mix of Florida vernacular furniture and items brought by snowbird residents.',
    commonItems:
      'Orlando estates frequently contain Florida cracker furniture, citrus crate labels and advertising, vintage Florida tourism memorabilia, and mid-century modern pieces from the post-WWII Florida boom. Native American Seminole crafts, Spanish colonial pieces from Florida\'s early history, and vintage Disney collectibles also appear regularly.',
    localScene:
      'Orlando\'s antique scene includes the Orlando Antique Mall, the monthly Winter Park antique shows, and estate sales throughout Orange and Seminole counties. The city\'s large retiree population drives a robust estate sale market, with items originating from across the United States.',
    appraisalTips:
      'Florida vernacular furniture (cracker-style pieces made from local cypress and pine) is an emerging category with growing collector interest. Orlando appraisers familiar with Florida\'s unique decorative arts traditions will provide better valuations than generalists. For citrus memorabilia and vintage Florida tourism items, condition and rarity are the primary value drivers.'
  },
  calgary: {
    marketOverview:
      'Calgary\'s antique market reflects Alberta\'s ranching heritage, oil boom prosperity, and Canadian Western identity. The region\'s estates contain pieces from the Canadian frontier era and the oil industry\'s mid-century wealth.',
    commonItems:
      'Commonly appraised items in Calgary include Western Canadian ranch equipment and decorative arts, Indigenous crafts from Plains Cree and Blackfoot communities, oil industry memorabilia, and Victorian-era pieces from Calgary\'s founding families. Stampede memorabilia and Canadian Pacific Railway artifacts also appear frequently.',
    localScene:
      'Calgary\'s antique circuit includes the Calgary Antique Market, the monthly CrossIron Mills antique shows, and estate sales throughout southern Alberta. The Calgary Stampede creates an annual surge in Western collectible interest and values.',
    appraisalTips:
      'For Western Canadian pieces, look for appraisers who understand the distinction between American and Canadian Western decorative arts — Canadian ranch pieces often carry different provenance and collector demand. Indigenous crafts from Plains Cree and Blackfoot communities require appraisers with specific knowledge of Canadian Indigenous art traditions. Oil industry memorabilia from Alberta\'s early boom years is an undervalued category.'
  },
  austin: {
    marketOverview:
      'Austin\'s antique market is shaped by Texas\'s unique cultural identity, the city\'s history as the state capital, and the influx of new residents bringing collections from across the country. The region\'s estates contain pieces from the Republic of Texas era through the modern tech boom.',
    commonItems:
      'Austin estates frequently feature Texas furniture and decorative arts, Republic of Texas memorabilia, vintage Western and ranch items, and music memorabilia from Austin\'s legendary live music scene. Spanish colonial pieces from Texas\'s early history and Native American crafts from Texas tribes also appear regularly.',
    localScene:
      'Austin\'s antique scene includes the Round Top Antique Show (one of the largest in the United States, held biannually), the Austin Antique Mall, and estate sales throughout Travis County and the Texas Hill Country. The city\'s proximity to the Hill Country creates a unique market for German-Texan and Czech-Texan decorative arts.',
    appraisalTips:
      'For Texas pieces, look for appraisers who understand the state\'s unique cultural blend of Spanish, Mexican, German, Czech, and Anglo traditions. Republic of Texas memorabilia (1836–1845) carries significant institutional collector demand. Hill Country German-Texan furniture is an underappreciated category with growing collector interest.'
  },
  honolulu: {
    marketOverview:
      'Honolulu\'s antique market reflects Hawaii\'s unique cultural heritage, its history as an independent kingdom, and the islands\' role as a Pacific crossroads. Estates in the Honolulu area contain pieces rarely found on the mainland, including Hawaiian royal-era items and Asian decorative arts.',
    commonItems:
      'Honolulu estates commonly feature Hawaiian quilts and textiles, koa wood furniture, Asian decorative arts (particularly Japanese and Chinese pieces brought by immigrant communities), and plantation-era memorabilia from Hawaii\'s sugar and pineapple industries. Hawaiian monarchy-era items and Pacific Islander crafts also appear regularly.',
    localScene:
      'Honolulu\'s antique scene includes the Honolulu Antique Market, the monthly Aloha Stadium swap meets, and estate sales throughout Oahu. The Bishop Museum and local historical societies provide provenance resources for Hawaiian historical pieces.',
    appraisalTips:
      'Hawaiian quilts and koa wood furniture are the most significant Hawaiian antique categories — pieces with documented royal-era provenance can command extraordinary premiums. Honolulu appraisers with Hawaiian cultural knowledge will provide valuations that mainland generalists cannot. For Asian decorative arts, Honolulu\'s position as a Pacific crossroads means pieces with unique provenance stories appear regularly.'
  },
  minneapolis: {
    marketOverview:
      'Minneapolis\'s antique market reflects Minnesota\'s Scandinavian heritage, logging and milling industry history, and the city\'s role as the Upper Midwest\'s commercial center. The region\'s estates contain pieces from over a century of accumulated wealth.',
    commonItems:
      'Commonly appraised items in Minneapolis include Scandinavian furniture and decorative arts (particularly Swedish, Norwegian, and Finnish pieces), logging and milling industry memorabilia, Native American crafts from Ojibwe and Dakota communities, and mid-century modern pieces from the post-WWII Minneapolis design movement. Grain industry advertising and agricultural collectibles also appear frequently.',
    localScene:
      'Minneapolis\'s antique circuit includes the Minneapolis Antique Market, the monthly St. Paul antique shows, and estate sales throughout the Twin Cities metro. The city\'s Scandinavian heritage creates a specialized collector base for Nordic decorative arts.',
    appraisalTips:
      'For Scandinavian pieces, Minneapolis appraisers with Nordic language skills and knowledge of European maker\'s marks will provide significantly better valuations. Native American crafts from Ojibwe and Dakota communities require appraisers who understand Upper Midwest Indigenous art traditions. Mid-century modern pieces from the Minneapolis design movement are an emerging category with growing collector interest.'
  },
  indianapolis: {
    marketOverview:
      'Indianapolis\'s antique market reflects Indiana\'s agricultural heritage, the city\'s history as a transportation hub, and the cultural impact of the Indianapolis 500. The region\'s estates contain pieces from the state\'s early settlement through the modern era.',
    commonItems:
      'Indianapolis estates frequently feature Indiana folk art, vintage racing memorabilia from the Indianapolis Motor Speedway, American prairie furniture, and agricultural collectibles from Indiana\'s farming communities. Glassware from Indiana\'s once-thriving glass manufacturing industry and vintage advertising from Indianapolis-based companies also appear regularly.',
    localScene:
      'Indianapolis\'s antique scene includes the Indianapolis Antique Mall, the monthly Indiana Antique Show, and estate sales throughout Marion County and central Indiana. The Indianapolis Motor Speedway Museum provides context for racing-related collectibles.',
    appraisalTips:
      'For racing memorabilia, Indianapolis appraisers with Motorsports Hall of Fame connections will provide the most accurate valuations. Indiana folk art is an emerging category — pieces with documented regional provenance carry premiums. For Indiana glassware, look for appraisers who understand the state\'s glass manufacturing history and can identify rare patterns.'
  },
  edmonton: {
    marketOverview:
      'Edmonton\'s antique market reflects Alberta\'s northern heritage, the city\'s role as a gateway to the Canadian North, and the oil industry\'s impact on the region\'s prosperity. Estates in the Edmonton area contain pieces from the fur trade era through the oil boom.',
    commonItems:
      'Commonly appraised items in Edmonton include Canadian Northern and Arctic exploration memorabilia, Indigenous crafts from Cree and Métis communities, oil industry artifacts, and Victorian-era pieces from Edmonton\'s founding families. Fur trade-era items and Hudson\'s Bay Company memorabilia also appear regularly.',
    localScene:
      'Edmonton\'s antique circuit includes the Edmonton Antique Market, the monthly Alberta Antique Show, and estate sales throughout northern Alberta. The Royal Alberta Museum provides provenance resources for Northern Canadian historical pieces.',
    appraisalTips:
      'For Northern Canadian pieces, look for appraisers who understand the region\'s unique fur trade and exploration history. Indigenous crafts from Cree and Métis communities require specialist knowledge of Canadian Indigenous art traditions. Oil industry artifacts from Alberta\'s early exploration period are an undervalued category with growing institutional interest.'
  },
  seattle: {
    marketOverview:
      'Seattle\'s antique market reflects the Pacific Northwest\'s logging and maritime heritage, the city\'s role as a gateway to Alaska and Asia, and the tech industry\'s recent impact on the region\'s wealth. The area\'s estates contain pieces from the Klondike Gold Rush era through the modern tech boom.',
    commonItems:
      'Seattle estates frequently feature Pacific Northwest Native American crafts (particularly Tlingit, Haida, and Coast Salish pieces), maritime artifacts from the Puget Sound shipping industry, Arts and Crafts furniture from the regional studio movement, and Asian decorative arts brought by immigrant communities. Klondike Gold Rush memorabilia and vintage Seattle advertising also appear regularly.',
    localScene:
      'Seattle\'s antique scene includes the Seattle Antique Market, the monthly Fremont Sunday Market, and estate sales throughout King County and the Puget Sound region. The Burke Museum and local historical societies provide provenance resources for Pacific Northwest Indigenous pieces.',
    appraisalTips:
      'For Pacific Northwest Native American crafts, Seattle appraisers with Indigenous art specialization will provide valuations that mainland generalists cannot. Tlingit and Haida pieces with documented artist attribution carry significant premiums. For maritime artifacts, look for appraisers who understand the Puget Sound shipping and fishing industry history.'
  },
  sacramento: {
    marketOverview:
      'Sacramento\'s antique market reflects California\'s Gold Rush heritage, the city\'s role as the state capital, and the agricultural wealth of the Central Valley. The region\'s estates contain pieces from the Gold Rush era through California\'s modern growth.',
    commonItems:
      'Sacramento estates commonly feature Gold Rush-era artifacts, California Victorian furniture, agricultural collectibles from the Central Valley, and Asian decorative arts brought by Chinese immigrant communities during the railroad era. Vintage California advertising and Native American crafts from California tribes also appear regularly.',
    localScene:
      'Sacramento\'s antique circuit includes the Sacramento Antique Fair, the monthly Old Sacramento market, and estate sales throughout Sacramento County and the surrounding Gold Country. The California State Railroad Museum and local historical societies provide provenance resources for Gold Rush-era pieces.',
    appraisalTips:
      'For Gold Rush-era items, Sacramento appraisers with California history specialization will provide the most accurate valuations. Gold Rush artifacts with documented connections to specific mining camps or historical figures carry significant premiums. For California Victorian furniture, look for appraisers who understand the regional cabinetmaking traditions that blended Eastern and local styles.'
  },
  philadelphia: {
    marketOverview:
      'Philadelphia\'s antique market is one of the oldest and most significant in the United States, reflecting the city\'s role as the birthplace of American democracy and its centuries-old tradition of fine craftsmanship. The region\'s estates contain pieces from the colonial era through the city\'s industrial peak.',
    commonItems:
      'Philadelphia estates commonly feature Philadelphia Chippendale furniture (among the most valuable American furniture categories), early American silver from Philadelphia silversmiths, Federal-period decorative arts, and pieces from the city\'s once-thriving textile and manufacturing industries. Asian export porcelain and European imports from Philadelphia\'s port era also appear regularly.',
    localScene:
      'Philadelphia\'s antique scene includes the Philadelphia Antique Show, the monthly Brimfield-adjacent markets, and estate sales throughout the Main Line neighborhoods and historic Pennsylvania counties. The Philadelphia Museum of Art and the Winterthur Museum provide provenance resources for American decorative arts.',
    appraisalTips:
      'Philadelphia Chippendale furniture is among the most valuable American furniture categories — pieces with documented Philadelphia provenance can command extraordinary premiums at auction. For early American silver, Philadelphia silversmiths like Joseph Richardson and Philip Syng are among the most collected. Philadelphia appraisers with American decorative arts specialization will provide valuations that generalists cannot match.'
  },
  'oklahoma-city': {
    marketOverview:
      'Oklahoma City\'s antique market reflects the state\'s unique blend of Native American heritage, the Land Run era, and the oil industry\'s impact on regional prosperity. The area\'s estates contain pieces from Oklahoma Territory\'s founding through the oil boom years.',
    commonItems:
      'Commonly appraised items in Oklahoma City include Native American crafts from the Five Civilized Tribes (Cherokee, Chickasaw, Choctaw, Creek, and Seminole), Land Run-era artifacts, oil industry memorabilia, and Western furniture and decorative arts. Vintage Oklahoma advertising and Route 66 memorabilia also appear frequently.',
    localScene:
      'Oklahoma City\'s antique circuit includes the Oklahoma City Antique Mall, the monthly Oklahoma Antique Show, and estate sales throughout Oklahoma County and the surrounding plains region. The Oklahoma History Center and local tribal museums provide provenance resources for Native American pieces.',
    appraisalTips:
      'For Native American crafts from the Five Civilized Tribes, look for appraisers who understand the distinct artistic traditions of each nation. Oil industry memorabilia from Oklahoma\'s early boom years is an undervalued category with growing collector interest. Route 66 memorabilia has appreciated significantly — items with documented connections to specific businesses or locations carry premiums.'
  },
  'new-york': {
    marketOverview:
      'New York City\'s antique market is the largest and most diverse in the United States, reflecting centuries of immigration, commerce, and cultural exchange. The region\'s estates contain pieces from the Dutch colonial era through the modern global art market.',
    commonItems:
      'New York estates commonly feature American and European fine and decorative arts, Hudson River School paintings, Federal and Empire period furniture from New York makers, and pieces from the city\'s once-thriving manufacturing industries. Asian decorative arts, European porcelain, and contemporary collectibles from the city\'s gallery scene also appear regularly.',
    localScene:
      'New York\'s antique scene includes the Park Avenue Armory shows, the Chelsea galleries, the Brimfield Antique Flea Markets (accessible from the city), and estate sales throughout the five boroughs, Westchester, and the Hamptons. The Metropolitan Museum of Art and Sotheby\'s/Christie\'s set national price benchmarks.',
    appraisalTips:
      'For American decorative arts, New York appraisers with museum-level expertise will provide the most accurate valuations. Hudson River School paintings and New York-made Federal furniture carry significant institutional collector demand. For contemporary collectibles, New York\'s position as the global art market center means local appraisers have access to the most current market data.'
  },
  toronto: {
    marketOverview:
      'Toronto\'s antique market reflects Canada\'s largest city\'s diverse cultural heritage, its history as a British colonial center, and the city\'s role as Canada\'s commercial capital. The region\'s estates contain pieces from Upper Canada\'s founding through the modern era.',
    commonItems:
      'Toronto estates frequently feature Canadiana furniture, British colonial decorative arts, Indigenous crafts from First Nations communities, and pieces from Toronto\'s once-thriving manufacturing industries. Victorian-era pieces from Toronto\'s founding families and Asian decorative arts brought by immigrant communities also appear regularly.',
    localScene:
      'Toronto\'s antique circuit includes the Toronto Antique Fair, the monthly Yorkville antique shows, and estate sales throughout the Greater Toronto Area. The Royal Ontario Museum and the Art Gallery of Ontario provide provenance resources for Canadian historical pieces.',
    appraisalTips:
      'For Canadiana pieces, Toronto appraisers with Canadian decorative arts specialization will provide valuations that American generalists cannot. Indigenous crafts from First Nations communities require appraisers who understand Canadian Indigenous art traditions and authentication protocols. British colonial decorative arts with Canadian provenance carry a dedicated collector base.'
  },
  wichita: {
    marketOverview:
      'Wichita\'s antique market reflects Kansas\'s agricultural heritage, the city\'s history as the "Cowtown" of the Chisholm Trail, and the aviation industry\'s impact on the region. The area\'s estates contain pieces from the cattle-driving era through the modern aviation boom.',
    commonItems:
      'Commonly appraised items in Wichita include Western ranch equipment and decorative arts, Chisholm Trail-era artifacts, aviation memorabilia from Wichita\'s identity as the "Air Capital of the World," and American prairie furniture. Native American crafts from Plains tribes and vintage Kansas advertising also appear frequently.',
    localScene:
      'Wichita\'s antique scene includes the Wichita Antique Market, the monthly Kansas Antique Show, and estate sales throughout Sedgwick County and south-central Kansas. The Kansas Museum of History and local historical societies provide provenance resources for Chisholm Trail-era pieces.',
    appraisalTips:
      'For Chisholm Trail-era artifacts, Wichita appraisers with Western history specialization will provide the most accurate valuations. Aviation memorabilia from Wichita\'s aircraft manufacturing heritage (Cessna, Beechcraft, Learjet) is an undervalued category with growing collector interest. For American prairie furniture, look for appraisers who understand the regional cabinetmaking traditions.'
  },
  'las-vegas': {
    marketOverview:
      'Las Vegas\'s antique market is shaped by the city\'s rapid growth from a desert railroad town to the entertainment capital of the world. The region\'s estates contain pieces from the Hoover Dam construction era, the Rat Pack years, and the casino boom.',
    commonItems:
      'Las Vegas estates frequently feature vintage casino memorabilia, Rat Pack-era collectibles, mid-century modern furniture from the 1950s–60s Vegas boom, and Native American crafts from Southwest tribes. Neon signs, vintage gambling equipment, and Hollywood memorabilia from the city\'s film and entertainment connections also appear regularly.',
    localScene:
      'Las Vegas\'s antique circuit includes the Las Vegas Antique Market, the monthly Las Vegas Antique Jewelry & Watch Show, and estate sales throughout Clark County. The city\'s large retiree population drives a robust estate sale market with items originating from across the United States.',
    appraisalTips:
      'For vintage casino memorabilia, Las Vegas appraisers with gaming history knowledge will provide the most accurate valuations. Pre-1980 casino chips, playing cards, and promotional items carry significant collector demand. For mid-century modern pieces from the Vegas boom era, look for appraisers who understand the intersection of American modern design and Las Vegas vernacular architecture.'
  },
  jacksonville: {
    marketOverview:
      'Jacksonville\'s antique market reflects Florida\'s oldest city\'s Spanish colonial heritage, the city\'s maritime history, and the influx of retirees bringing collections from across the country. The region\'s estates contain pieces from Florida\'s earliest European settlement through the modern era.',
    commonItems:
      'Jacksonville estates commonly feature Spanish colonial decorative arts, Florida cracker furniture, maritime artifacts from the St. Johns River shipping industry, and vintage Florida tourism memorabilia. Native American crafts from Florida tribes and Confederate-era artifacts from the Civil War period also appear regularly.',
    localScene:
      'Jacksonville\'s antique scene includes the Jacksonville Antique Mall, the monthly Riverside antique shows, and estate sales throughout Duval County and northeastern Florida. The Museum of Science & History and local historical societies provide provenance resources for Spanish colonial pieces.',
    appraisalTips:
      'For Spanish colonial pieces in Florida, Jacksonville appraisers with Spanish colonial art knowledge will provide valuations that generalists cannot. Florida cracker furniture is an emerging category with growing collector interest. For maritime artifacts, look for appraisers who understand the St. Johns River shipping and naval history.'
  },
  pittsburgh: {
    marketOverview:
      'Pittsburgh\'s antique market reflects the city\'s history as an industrial powerhouse, its Gilded Age wealth, and the cultural heritage of the region\'s immigrant communities. The area\'s estates contain pieces from the steel industry\'s peak through the city\'s modern transformation.',
    commonItems:
      'Pittsburgh estates frequently feature Gilded Age furniture and decorative arts from the Carnegie era, industrial artifacts from the steel industry, European decorative arts brought by immigrant communities (particularly Eastern European and Italian), and American pressed glass from Pittsburgh\'s once-dominant glass manufacturing industry. Civil War artifacts from Pennsylvania regiments also appear regularly.',
    localScene:
      'Pittsburgh\'s antique circuit includes the Pittsburgh Antique Show, the monthly Strip District markets, and estate sales throughout Allegheny County and the surrounding Western Pennsylvania region. The Carnegie Museum and local historical societies provide provenance resources for Gilded Age pieces.',
    appraisalTips:
      'For Gilded Age pieces, Pittsburgh appraisers with industrial history knowledge will provide the most accurate valuations. American pressed glass from Pittsburgh manufacturers (Heisey, Cambridge, and others) is a significant category with dedicated collector networks. For industrial artifacts, look for appraisers who understand the steel industry\'s historical significance and can identify rare or historically important pieces.'
  },
  tampa: {
    marketOverview:
      'Tampa\'s antique market is shaped by the city\'s cigar industry heritage, Cuban and Spanish immigrant communities, and Florida\'s land boom era. The region\'s estates contain pieces from Tampa\'s Ybor City heyday through the modern Florida growth period.',
    commonItems:
      'Tampa estates commonly feature Cuban and Spanish decorative arts, cigar industry memorabilia from Ybor City, Florida cracker furniture, and vintage Florida tourism items. Native American crafts from Florida tribes, maritime artifacts from Tampa Bay, and mid-century modern pieces from the post-WWII Florida boom also appear regularly.',
    localScene:
      'Tampa\'s antique scene includes the Tampa Antique Mall, the monthly Ybor City antique shows, and estate sales throughout Hillsborough County and the Tampa Bay area. The Cuban Heritage Museum and local historical societies provide provenance resources for Cuban-Spanish pieces.',
    appraisalTips:
      'For Cuban and Spanish decorative arts, Tampa appraisers with Latin American art knowledge will provide the most accurate valuations. Cigar industry memorabilia from Ybor City\'s peak years carries significant regional collector demand. For Florida cracker furniture, look for appraisers who understand the vernacular building and furniture-making traditions of early Florida.'
  },
  richmond: {
    marketOverview:
      'Richmond\'s antique market reflects Virginia\'s colonial heritage, the city\'s role as the Confederate capital, and the agricultural wealth of the Tidewater and Piedmont regions. The area\'s estates contain pieces from the earliest English settlements through the modern era.',
    commonItems:
      'Richmond estates frequently feature Virginia Federal furniture, Confederate-era artifacts, American silver from Virginia silversmiths, and pieces from the state\'s plantation-era estates. English export porcelain, early American paintings, and decorative arts from Richmond\'s manufacturing industries also appear regularly.',
    localScene:
      'Richmond\'s antique circuit includes the Richmond Antique Show, the monthly Virginia Antique Fair, and estate sales throughout the Tidewater and Piedmont regions. The Virginia Museum of Fine Arts and the Valentine Museum provide provenance resources for Virginia historical pieces.',
    appraisalTips:
      'For Virginia Federal furniture, Richmond appraisers with Southern decorative arts specialization will provide the most accurate valuations. Confederate-era artifacts require appraisers who understand the historical context and can distinguish between period pieces and later commemoratives. For American silver from Virginia makers, look for appraisers who understand the regional silversmithing traditions.'
  },
  'new-orleans': {
    marketOverview:
      'New Orleans\' antique market is one of the most distinctive in the United States, reflecting the city\'s French and Spanish colonial heritage, its role as a major port, and the unique cultural blend of Creole, Cajun, and American influences. The region\'s estates contain pieces rarely found elsewhere.',
    commonItems:
      'New Orleans estates commonly feature French and Spanish colonial furniture, Creole decorative arts, Mardi Gras memorabilia, and pieces from the city\'s once-thriving cotton and sugar industries. Jazz-era collectibles, Caribbean decorative arts, and European imports from New Orleans\'s port era also appear regularly.',
    localScene:
      'New Orleans\'s antique scene includes the Royal Street antique galleries, the monthly New Orleans Antique Show, and estate sales throughout the French Quarter, Garden District, and surrounding plantation country. The Historic New Orleans Collection and local museums provide provenance resources for Creole and colonial pieces.',
    appraisalTips:
      'For French and Spanish colonial furniture, New Orleans appraisers with Creole decorative arts knowledge will provide valuations that generalists cannot. Mardi Gras memorabilia from the 19th and early 20th centuries carries significant collector demand. For plantation-era pieces, look for appraisers who understand the Southern decorative arts traditions and can identify New Orleans-made pieces from other Southern cities.'
  }
};

const LOCATION_INTERNAL_LINK_TARGETS: Partial<
  Record<(typeof STRIKING_DISTANCE_CITY_SLUGS)[number], readonly string[]>
> = {
  'des-moines': ['kansas-city', 'chicago', 'columbus'],
  'kansas-city': ['des-moines', 'st-louis', 'chicago'],
  chicago: ['milwaukee', 'columbus', 'cleveland'],
  tucson: ['phoenix', 'denver', 'albuquerque'],
  columbus: ['cleveland', 'cincinnati', 'louisville'],
  denver: ['colorado-springs', 'aspen', 'kansas-city'],
  milwaukee: ['chicago', 'minneapolis', 'cleveland'],
  cleveland: ['columbus', 'cincinnati', 'pittsburgh'],
  cincinnati: ['columbus', 'louisville', 'indianapolis'],
  baltimore: ['washington-dc', 'philadelphia', 'columbus'],
  louisville: ['lexington', 'cincinnati', 'columbus'],
  ottawa: ['toronto', 'hamilton', 'london'],
  orlando: ['tampa', 'miami', 'jacksonville'],
  'san-antonio': ['austin', 'houston', 'dallas'],
  calgary: ['edmonton', 'vancouver', 'seattle'],
  austin: ['san-antonio', 'houston', 'dallas'],
  honolulu: ['los-angeles', 'san-francisco', 'seattle'],
  minneapolis: ['st-paul', 'milwaukee', 'chicago'],
  indianapolis: ['louisville', 'columbus', 'chicago'],
  edmonton: ['calgary', 'vancouver', 'seattle'],
  seattle: ['portland', 'vancouver', 'san-francisco'],
  sacramento: ['san-francisco', 'san-jose', 'los-angeles'],
  philadelphia: ['new-york', 'baltimore', 'pittsburgh'],
  'oklahoma-city': ['tulsa', 'wichita', 'dallas'],
  'new-york': ['philadelphia', 'boston', 'hartford'],
  toronto: ['ottawa', 'hamilton', 'london'],
  wichita: ['oklahoma-city', 'kansas-city', 'tulsa'],
  'las-vegas': ['phoenix', 'los-angeles', 'denver'],
  jacksonville: ['tampa', 'orlando', 'miami'],
  pittsburgh: ['cleveland', 'columbus', 'philadelphia'],
  tampa: ['orlando', 'jacksonville', 'miami'],
  richmond: ['baltimore', 'charlotte', 'raleigh'],
  'new-orleans': ['houston', 'baton-rouge', 'jacksonville']
};

const LOCATION_SEO_OVERRIDES: Partial<
  Record<(typeof STRIKING_DISTANCE_CITY_SLUGS)[number], LocationSeoOverride>
> = {
  'des-moines': {
    title: 'Des Moines Antique Appraisers & Art Appraisal Services | Estate, Donation, Insurance',
    description:
      'Compare Des Moines antique appraisers and art appraisal services for donation, estate, insurance, and personal-property valuations. Review local experts and online options.',
    h1: 'Des Moines Antique Appraisers & Art Appraisal Services',
    heroDescription:
      'Compare Des Moines specialists for antique and art appraisals, then choose the right fit for donation, estate, insurance, and personal-property needs.'
  },
  'kansas-city': {
    title: 'Kansas City Antique Appraisers & Art Appraisal Services | Estate, Donation, Insurance',
    description:
      'Compare Kansas City antique appraisers and art appraisal services for estate, donation, insurance, and personal-property valuations. Review local experts and online options.',
    h1: 'Kansas City Antique Appraisers & Art Appraisal Services',
    heroDescription:
      'Compare Kansas City specialists for antique and art appraisals, then choose the right fit for estate, donation, insurance, and personal-property needs.'
  },
  chicago: {
    title: 'Antique Appraisers in Chicago, IL — Compare Local Experts & Online Options',
    description:
      'Find trusted antique appraisers in Chicago for Arts & Crafts, WPA-era art, and estate items. Compare in-person specialists or get an online valuation in 24–48 hours.',
    h1: 'Antique Appraisers in Chicago, IL',
    heroDescription:
      'Compare Chicago appraisers for antiques, art, and collections, then choose local in-person service or a faster online appraisal route.'
  },
  tucson: {
    title: 'Tucson Antique Appraisers & Art Appraisers | Donation and Personal Property',
    description:
      'Compare Tucson antique and art appraisers for donation, estate, and personal property valuation reports. Choose local or online service.',
    h1: 'Tucson Antique & Art Appraisers',
    heroDescription:
      'Compare Tucson specialists for antique, art, and donation valuations, then pick the local or online path that matches your timeline.'
  },
  columbus: {
    title: 'Columbus, OH Antique Appraisers — Rookwood, Ohio Pottery & Estate Valuations',
    description:
      'Compare Columbus antique appraisers specializing in Ohio art pottery, folk art, and estate items. Get a free online estimate or schedule a local appraisal today.',
    h1: 'Columbus, OH Antique Appraisers',
    heroDescription:
      'Compare Columbus appraisal experts for donation, estate, insurance, and personal-property needs before choosing local in-person or online service.'
  },
  denver: {
    title: 'Denver Antique Appraisers — Estate, Insurance & Donation Valuations',
    description:
      'Find Denver antique appraisers for Western art, Native American pieces, mining-era antiques, and estate valuations. Compare local experts or choose online appraisal.',
    h1: 'Denver Antique Appraisers',
    heroDescription:
      'Compare Denver specialists for antique and art appraisals, then choose the right fit for estate, insurance, donation, and personal-property needs.'
  },
  milwaukee: {
    title: 'Milwaukee Antique Appraisers — Compare Local Specialists & Fast Online Appraisals',
    description:
      'Compare Milwaukee antique appraisers for German glassware, brewery memorabilia, and estate items. Or skip the wait — get a signed online valuation in 24–48 hours.',
    h1: 'Milwaukee Antique Appraisers',
    heroDescription:
      'Compare Milwaukee appraisal options for antiques, estate items, and art, then choose local in-person service or online turnaround.'
  },
  cleveland: {
    title: 'Cleveland Antique Appraisers & Art Appraisal Services | Estate, Donation, Insurance',
    description:
      'Compare Cleveland antique appraisers and art appraisal services for estate, donation, insurance, and personal-property valuations. Review local experts and online options.',
    h1: 'Cleveland Antique Appraisers & Art Appraisal Services',
    heroDescription:
      'Compare Cleveland specialists for antique and art appraisals, then choose the right fit for estate, donation, insurance, and personal-property needs.'
  },
  cincinnati: {
    title: 'Cincinnati Personal Property Appraisers | Antique and Art Appraisal',
    description:
      'Compare Cincinnati antique and art appraisers for personal property, tax donation, estate, and insurance valuation needs.',
    h1: 'Cincinnati Personal Property Appraisers',
    heroDescription:
      'Review Cincinnati appraisal options for antiques, art, and personal property, then choose local in-person service or online appraisal support.'
  },
  louisville: {
    title: 'Louisville Antique & Art Appraisers Near You | Donation, Estate & Insurance',
    description:
      'Need an appraisal in Louisville? Compare local antique and art appraisers for donation, estate, insurance, and personal-property reports. Choose in-person or online.',
    h1: 'Louisville Antique & Art Appraisers',
    heroDescription:
      'Find Louisville specialists for antique, art, and tax-related valuations, then choose local in-person or faster online appraisal.'
  },
  baltimore: {
    title: 'Baltimore Antique Appraisers — Compare Maryland Experts & Online Options',
    description:
      'Compare Baltimore antique appraisers for Chesapeake-region silver, federal-period furniture, and estate valuations. Local specialists and online appraisals available.',
    h1: 'Baltimore Antique Appraisers',
    heroDescription:
      'Compare Baltimore specialists for antique and art appraisals, then choose the right fit for estate, insurance, donation, and personal-property needs.'
  },
  ottawa: {
    title: 'Ottawa Antique & Art Appraisers | ON Estate, Insurance & Donation',
    description:
      'Compare Ottawa antique and art appraisers for estate, insurance, donation, and personal property valuation. Review Ontario specialists and online options.',
    h1: 'Ottawa Antique & Art Appraisers',
    heroDescription:
      'Compare Ottawa specialists for antique and art valuation, then choose local in-person service or faster online appraisal support.'
  },
  orlando: {
    title: 'Orlando Antique Appraisers | Art, Estate & Insurance Values',
    description:
      'Compare Orlando antique and art appraisers for estate, donation, insurance, and resale valuation. Review specialties and choose local or online appraisal.',
    h1: 'Orlando Antique & Art Appraisers',
    heroDescription:
      'Compare Orlando specialists for antiques, art, and collection valuation, then choose a local visit or faster online appraisal.'
  },
  'san-antonio': {
    title: 'San Antonio Antique Appraisers | Art & Estate Value Experts',
    description:
      'Find San Antonio antique and art appraisers for estate, donation, insurance, and personal property valuation. Compare local providers and online options.',
    h1: 'San Antonio Antique & Art Appraisers',
    heroDescription:
      'Review San Antonio appraisal options for art, antiques, and estate items before choosing local in-person or online service.'
  },
  calgary: {
    title: 'Calgary Antique Appraisers | Art, Estate & Donation Values',
    description:
      'Compare Calgary antique and art appraisers for donation, estate, insurance, and personal property valuation. Choose trusted local or online support.',
    h1: 'Calgary Antique & Art Appraisers',
    heroDescription:
      'Compare Calgary appraisal specialists for antiques, art, and collections before selecting local in-person or online service.'
  },
  austin: {
    title: 'Austin Antique Appraisers | Art, Tax & Donation Valuations',
    description:
      'Compare Austin antique and art appraisers for tax donation, estate, insurance, and resale valuation. Review specialties, fees, and local coverage.',
    h1: 'Austin Antique & Art Appraisers',
    heroDescription:
      'Find Austin appraisers for antiques, art, and personal property valuation, then choose local appointments or online turnaround.'
  },
  honolulu: {
    title: 'Honolulu Antique Appraisers | Art, Estate & Insurance Help',
    description:
      'Find Honolulu antique and art appraisers for estate, insurance, donation, and resale valuation. Compare specialties and select local or online service.',
    h1: 'Honolulu Antique & Art Appraisers',
    heroDescription:
      'Review Honolulu appraisal options for antiques, art, and estate items to pick the right local or online valuation path.'
  },
  minneapolis: {
    title: 'Minneapolis Antique Appraisers | Art & Estate Value Experts',
    description:
      'Compare Minneapolis antique and art appraisers for estate, donation, insurance, and personal property valuation. Review credentials and specialties.',
    h1: 'Minneapolis Antique & Art Appraisers',
    heroDescription:
      'Find Minneapolis specialists for antique and art valuation, then choose local in-person appointments or online support.'
  },
  indianapolis: {
    title: 'Indianapolis Antique Appraisers | Art, Donation & Estate Values',
    description:
      'Find Indianapolis antique and art appraisers for donation, estate, insurance, and resale valuation. Compare local providers and online appraisal options.',
    h1: 'Indianapolis Antique & Art Appraisers',
    heroDescription:
      'Review Indianapolis appraisers for art and antiques, then choose the best local or online valuation route for your timeline.'
  },
  edmonton: {
    title: 'Edmonton Antique Appraisers | Art, Insurance & Estate Values',
    description:
      'Compare Edmonton antique and art appraisers for estate, donation, insurance, and collection valuation. Review local specialties and online alternatives.',
    h1: 'Edmonton Antique & Art Appraisers',
    heroDescription:
      'Compare Edmonton appraisal providers for antiques, art, and personal property to choose local or online valuation.'
  },
  seattle: {
    title: 'Seattle Art Appraisal Services & Antique Appraisers | Estate, Insurance, Donation',
    description:
      'Compare Seattle art appraisal services and antique appraisers for estate planning, insurance, donation, and resale valuation. Check specialties and request support.',
    h1: 'Seattle Art Appraisal Services & Antique Appraisers',
    heroDescription:
      'Find Seattle appraisal specialists for antiques, art, and collections, then choose local in-person or online valuation support.'
  },
  sacramento: {
    title: 'Sacramento Antique Appraisers | Art, Tax & Estate Valuation',
    description:
      'Compare Sacramento antique and art appraisers for tax donation, estate, insurance, and personal property valuation. Review local and online options.',
    h1: 'Sacramento Antique & Art Appraisers',
    heroDescription:
      'Compare Sacramento appraisers for antiques and art valuation, then choose local appointments or faster online appraisal.'
  },
  philadelphia: {
    title: 'Philadelphia Antique Appraisers & Art Appraisal Services | Estate, Insurance, Donation',
    description:
      'Compare Philadelphia antique appraisers and art appraisal services for estate, insurance, donation, and personal-property valuations. Review local experts and online options.',
    h1: 'Philadelphia Antique Appraisers & Art Appraisal Services',
    heroDescription:
      'Compare Philadelphia specialists for antique and art appraisals, then choose the right fit for estate, insurance, donation, and personal-property needs.'
  },
  'oklahoma-city': {
    title: 'Oklahoma City Antique Appraisers & Art Appraisal Services | Estate, Donation, Insurance',
    description:
      'Compare Oklahoma City antique appraisers and art appraisal services for estate, donation, insurance, and personal-property valuations. Review local experts and online options.',
    h1: 'Oklahoma City Antique Appraisers & Art Appraisal Services',
    heroDescription:
      'Compare Oklahoma City specialists for antique and art appraisals, then choose the right fit for estate, donation, insurance, and personal-property needs.'
  },
  'new-york': {
    title: 'New York Antique Appraisers & Art Appraisal Services | Estate, Insurance, Donation',
    description:
      'Compare New York antique appraisers and art appraisal services for estate planning, insurance, donation, and resale valuations. Review local NYC experts and online options.',
    h1: 'New York Antique Appraisers & Art Appraisal Services',
    heroDescription:
      'Compare New York City appraisers for antiques, fine art, and collections, then choose local in-person service or online turnaround.'
  },
  toronto: {
    title: 'Toronto Antique Appraisers & Art Appraisal Services | Estate, Insurance, Donation',
    description:
      'Compare Toronto antique appraisers and art appraisal services for estate, insurance, donation, and personal-property valuations. Review Ontario experts and online options.',
    h1: 'Toronto Antique Appraisers & Art Appraisal Services',
    heroDescription:
      'Compare Toronto specialists for antique and art appraisals, then choose the right fit for estate, insurance, donation, and personal-property needs.'
  },
  wichita: {
    title: 'Wichita Antique Appraisers & Art Appraisal Services | Estate, Donation, Insurance',
    description:
      'Compare Wichita antique appraisers and art appraisal services for estate, donation, insurance, and personal-property valuations. Review local Kansas experts and online options.',
    h1: 'Wichita Antique Appraisers & Art Appraisal Services',
    heroDescription:
      'Compare Wichita specialists for antique and art appraisals, then choose the right fit for estate, donation, insurance, and personal-property needs.'
  },
  'las-vegas': {
    title: 'Las Vegas Antique Appraisers & Art Appraisal Services | Estate, Insurance, Donation',
    description:
      'Compare Las Vegas antique appraisers and art appraisal services for estate, insurance, donation, and personal-property valuations. Review local Nevada experts and online options.',
    h1: 'Las Vegas Antique Appraisers & Art Appraisal Services',
    heroDescription:
      'Compare Las Vegas specialists for antique and art appraisals, then choose the right fit for estate, insurance, donation, and personal-property needs.'
  },
  jacksonville: {
    title: 'Jacksonville Antique Appraisers & Art Appraisal Services | Estate, Donation, Insurance',
    description:
      'Compare Jacksonville antique appraisers and art appraisal services for estate, donation, insurance, and personal-property valuations. Review local Florida experts and online options.',
    h1: 'Jacksonville Antique Appraisers & Art Appraisal Services',
    heroDescription:
      'Compare Jacksonville specialists for antique and art appraisals, then choose the right fit for estate, donation, insurance, and personal-property needs.'
  },
  pittsburgh: {
    title: 'Pittsburgh Antique Appraisers & Art Appraisal Services | Estate, Donation, Insurance',
    description:
      'Compare Pittsburgh antique appraisers and art appraisal services for estate, donation, insurance, and personal-property valuations. Review local experts and online options.',
    h1: 'Pittsburgh Antique Appraisers & Art Appraisal Services',
    heroDescription:
      'Compare Pittsburgh specialists for antique and art appraisals, then choose the right fit for estate, donation, insurance, and personal-property needs.'
  },
  tampa: {
    title: 'Tampa Antique Appraisers & Art Appraisal Services | Estate, Insurance, Donation',
    description:
      'Compare Tampa antique appraisers and art appraisal services for estate, insurance, donation, and personal-property valuations. Review local Florida experts and online options.',
    h1: 'Tampa Antique Appraisers & Art Appraisal Services',
    heroDescription:
      'Compare Tampa specialists for antique and art appraisals, then choose the right fit for estate, insurance, donation, and personal-property needs.'
  },
  richmond: {
    title: 'Richmond Antique Appraisers & Art Appraisal Services | Estate, Donation, Insurance',
    description:
      'Compare Richmond antique appraisers and art appraisal services for estate, donation, insurance, and personal-property valuations. Review local Virginia experts and online options.',
    h1: 'Richmond Antique Appraisers & Art Appraisal Services',
    heroDescription:
      'Compare Richmond specialists for antique and art appraisals, then choose the right fit for estate, donation, insurance, and personal-property needs.'
  },
  'new-orleans': {
    title: 'New Orleans Antique Appraisers & Art Appraisal Services | Estate, Insurance, Donation',
    description:
      'Compare New Orleans antique appraisers and art appraisal services for estate, insurance, donation, and personal-property valuations. Review local Louisiana experts and online options.',
    h1: 'New Orleans Antique Appraisers & Art Appraisal Services',
    heroDescription:
      'Compare New Orleans specialists for antique and art appraisals, then choose the right fit for estate, insurance, donation, and personal-property needs.'
  }
};

const LOCATION_SEARCH_THEMES: Record<string, readonly string[]> = {
 'des-moines': [
   'Des Moines antique appraisers',
   'Des Moines art appraisals',
   'Des Moines art appraisers',
   'certified antique appraisers Des Moines'
 ],
 chicago: [
   'Chicago antique appraisers',
   'Chicago art appraisal services',
   'Chicago art appraisers',
   'antique appraisers Chicago IL'
 ],
 milwaukee: [
   'Antique appraisal Milwaukee',
   'Milwaukee antique appraisers',
   'Milwaukee art appraisal services'
 ],
 columbus: [
   'Columbus art appraiser',
   'Columbus antique appraisers',
   'Columbus art appraisal services',
   'antique appraisers Columbus Ohio'
 ],
 seattle: [
   'Seattle art appraisal services',
   'Seattle antique appraisers',
   'Seattle art appraisers'
 ],
 denver: [
   'Denver antique appraisers',
   'Denver art appraisal services',
   'antique appraisers near me Denver',
   'Denver art appraisers'
 ],
 cleveland: [
   'Cleveland antique appraiser',
   'Cleveland art appraisers',
   'antique appraisal Cleveland OH'
 ],
 cincinnati: [
   'Cincinnati antique appraisers',
   'Cincinnati art appraisal',
   'personal property appraisers Cincinnati'
 ],
 baltimore: [
   'Antique appraisers in Baltimore Maryland',
   'Baltimore art appraisal services',
   'Baltimore antique appraisals'
 ],
 louisville: [
   'Louisville antique appraisers',
   'Louisville art appraisal',
   'antique appraisers Louisville KY'
 ],
 'san-antonio': [
   'San Antonio antique appraisers',
   'San Antonio art appraisal',
   'antique appraisers San Antonio TX'
 ],
 tucson: [
   'Tucson antique appraisers',
   'Tucson art appraisal',
   'antique appraisers Tucson AZ'
 ],
 indianapolis: [
   'Indianapolis antique appraisers',
   'Indianapolis art appraisers',
   'antique appraisal Indianapolis IN'
 ],
 minneapolis: [
   'Minneapolis antique appraisers',
   'Minneapolis art appraisal',
   'antique appraisers Minneapolis MN'
 ],
 philadelphia: [
   'Philadelphia antique appraisers',
   'Philadelphia art appraisal services',
   'antique appraisers Philadelphia PA'
 ],
 'oklahoma-city': [
   'Oklahoma City antique appraisers',
   'OKC art appraisal',
   'antique appraisers Oklahoma City'
 ],
 orlando: [
   'Orlando antique appraisers',
   'Orlando art appraisal',
   'antique appraisers Orlando FL'
 ],
 austin: [
   'Austin antique appraisers',
   'Austin art appraisal',
   'antique appraisers Austin TX'
 ],
 calgary: [
   'Calgary antique appraisers',
   'Calgary art appraisal',
   'antique appraisers Calgary AB'
 ],
 'new-york': [
   'New York antique appraisers',
   'NYC art appraisal services',
   'antique appraisers New York'
 ],
 honolulu: [
   'Honolulu antique appraisers',
   'Oahu antique appraiser',
   'art appraisal Honolulu HI'
 ],
 edmonton: [
   'Edmonton antique appraisers',
   'Edmonton art appraisal',
   'antique appraisers Edmonton AB'
 ],
 sacramento: [
   'Sacramento antique appraisers',
   'Sacramento art appraisal',
   'antique appraisers Sacramento CA'
 ],
 'las-vegas': [
   'Las Vegas antique appraisers',
   'Las Vegas art appraisal',
   'antique appraisers Las Vegas NV'
 ],
 jacksonville: [
   'Jacksonville antique appraisers',
   'Jacksonville art appraisers',
   'antique appraisers Jacksonville FL'
 ],
 pittsburgh: [
   'Pittsburgh antique appraisers',
   'Pittsburgh art appraisal',
   'antique appraisers Pittsburgh PA'
 ],
 tampa: [
   'Tampa antique appraisers',
   'Tampa art appraisal',
   'antique appraisers Tampa FL'
 ],
 richmond: [
   'Richmond antique appraisers',
   'Richmond art appraisal',
   'antique appraisers Richmond VA'
 ],
 'new-orleans': [
   'New Orleans antique appraisers',
   'New Orleans art appraisal',
   'antique appraisers New Orleans LA'
 ],
 wichita: [
   'Wichita antique appraisers',
   'Wichita art appraisal',
   'antique appraisers Wichita KS'
 ],
 ottawa: [
   'Ottawa antique appraisers',
   'Ottawa art appraisal',
   'antique appraisers Ottawa ON'
 ],
 toronto: [
   'Toronto antique appraisers',
   'Toronto art appraisal services',
   'antique appraisers Toronto ON'
 ]
};
function estimateDistanceKm(fromCity: DirectoryCity, toCity: DirectoryCity): number {
  if (
    typeof fromCity.latitude !== 'number' ||
    typeof fromCity.longitude !== 'number' ||
    typeof toCity.latitude !== 'number' ||
    typeof toCity.longitude !== 'number'
  ) {
    return Number.POSITIVE_INFINITY;
  }

  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(toCity.latitude - fromCity.latitude);
  const dLon = toRad(toCity.longitude - fromCity.longitude);
  const lat1 = toRad(fromCity.latitude);
  const lat2 = toRad(toCity.latitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function StandardizedLocationPage() {
  const { citySlug } = useParams<{ citySlug: string }>();
  const [locationData, setLocationData] = useState<StandardizedLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const primaryCtaUrl = getPrimaryCtaUrl();

  const validCitySlug = typeof citySlug === 'string' ? citySlug : '';
  const cityMeta = useMemo(
    () => directoryCities.find(city => city.slug === validCitySlug) ?? null,
    [validCitySlug]
  );

  useEffect(() => {
    async function fetchData() {
      if (!validCitySlug) {
        setError('Invalid city slug');
        setIsLoading(false);
        return;
      }

      // If the slug is not in our known city list, treat as 404
      if (!cityMeta) {
        setError('not_found');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const data = await getStandardizedLocation(validCitySlug);
        if (data) {
          setLocationData(data);
        } else {
          setError(`No data found for ${validCitySlug}`);
        }
      } catch (err) {
        console.error('Error fetching location data:', err);
        setError('Failed to load location data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [validCitySlug, cityMeta]);

  useEffect(() => {
    if (!locationData || locationData.appraisers.length === 0) {
      return;
    }

    trackEvent('view_item_list', {
      page_type: 'location',
      city_slug: validCitySlug,
      city_name: cityMeta?.name,
      state: cityMeta?.state,
      items: locationData.appraisers.slice(0, 25).map(appraiser => ({
        item_id: appraiser.slug,
        item_name: appraiser.name,
        city: appraiser.address.city,
        state: appraiser.address.state,
        rating: appraiser.business.rating,
        review_count: appraiser.business.reviewCount
      }))
    });
  }, [cityMeta, locationData, validCitySlug]);

  const cityName = useMemo(() => {
    if (cityMeta) {
      return `${cityMeta.name}, ${cityMeta.state}`;
    }

    if (!validCitySlug) {
      return 'Location';
    }

    return validCitySlug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }, [cityMeta, validCitySlug]);
  const topSpecialties = useMemo(() => {
    if (!locationData?.appraisers?.length) return [];
    const counts = new Map<string, number>();
    locationData.appraisers.forEach(appraiser => {
      appraiser.expertise.specialties.forEach(specialty => {
        counts.set(specialty, (counts.get(specialty) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([specialty]) => specialty);
  }, [locationData]);
  const citySearchName = useMemo(() => {
    if (cityMeta?.name) return cityMeta.name;
    return cityName.split(',')[0]?.trim() || cityName;
  }, [cityMeta, cityName]);
  const locationSearchThemes = useMemo(
    () => LOCATION_SEARCH_THEMES[validCitySlug] ?? [],
    [validCitySlug]
  );
  const locationPath = `/location/${validCitySlug}`;
  const locationCanonicalUrl = useMemo(() => buildSiteUrl(locationPath), [locationPath]);
  const relatedCities = useMemo(() => {
    const typedCities = directoryCities as DirectoryCity[];
    const fallback = typedCities
      .filter(city => city.slug !== validCitySlug)
      .slice(0, 6);

    if (!cityMeta?.state) {
      return fallback;
    }

    const sameStateCities = typedCities.filter(
      city => city.slug !== validCitySlug && city.state === cityMeta.state
    );

    if (sameStateCities.length === 0) {
      return fallback;
    }

    const origin = cityMeta as DirectoryCity;
    return sameStateCities
      .map(city => ({
        city,
        distanceKm: estimateDistanceKm(origin, city),
      }))
      .sort((a, b) => {
        if (a.distanceKm !== b.distanceKm) {
          return a.distanceKm - b.distanceKm;
        }
        return a.city.name.localeCompare(b.city.name);
      })
      .slice(0, 6)
      .map(item => item.city);
  }, [cityMeta, validCitySlug]);
  const prioritizedInternalLinkCities = useMemo(() => {
    const typedCities = directoryCities as DirectoryCity[];
    const linkSlugs = LOCATION_INTERNAL_LINK_TARGETS[
      validCitySlug as (typeof STRIKING_DISTANCE_CITY_SLUGS)[number]
    ];
    if (!linkSlugs?.length) return [];
    return linkSlugs
      .map((slug) => typedCities.find(city => city.slug === slug))
      .filter((city): city is DirectoryCity => Boolean(city) && city.slug !== validCitySlug);
  }, [validCitySlug]);
  const popularOpportunityCities = useMemo(() => {
    const typedCities = directoryCities as DirectoryCity[];
    return STRIKING_DISTANCE_CITY_SLUGS
      .map((slug) => typedCities.find(city => city.slug === slug))
      .filter((city): city is DirectoryCity => Boolean(city) && city.slug !== validCitySlug);
  }, [validCitySlug]);
  const topReviewedAppraisers = useMemo(() => {
    if (!locationData?.appraisers?.length) return [];
    return [...locationData.appraisers]
      .filter(appraiser => appraiser.business.reviewCount > 0)
      .sort((a, b) => {
        if (b.business.reviewCount !== a.business.reviewCount) {
          return b.business.reviewCount - a.business.reviewCount;
        }
        return b.business.rating - a.business.rating;
      })
      .slice(0, 5);
  }, [locationData]);
  const seoKeywords = useMemo(
    () => [
      `art appraisers in ${citySearchName}`,
      `${citySearchName} art appraiser`,
      `art appraisal ${citySearchName}`,
      `antique appraisers in ${citySearchName}`,
      `${citySearchName} antique appraisers`,
      `${citySearchName} antique appraisals`,
      `antique appraisal ${citySearchName}`,
      `antique appraiser near ${citySearchName}`,
      'antique appraisers near me',
      'antique appraisal near me',
      'online antique appraisal',
    ],
    [citySearchName]
  );

  const generateBreadcrumbSchema = () => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: SITE_URL
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: `Antique Appraisers in ${cityName}`,
        item: buildSiteUrl(`/location/${validCitySlug}`)
      }
    ]
  });

  const seoOverride = LOCATION_SEO_OVERRIDES[validCitySlug as (typeof STRIKING_DISTANCE_CITY_SLUGS)[number]];
  const cityGuide = LOCATION_GUIDE_CONTENT[validCitySlug as (typeof STRIKING_DISTANCE_CITY_SLUGS)[number]];
  const isLowCtrPriorityCity = LOW_CTR_PRIORITY_CITY_SLUGS.includes(
    validCitySlug as (typeof LOW_CTR_PRIORITY_CITY_SLUGS)[number]
  );
  const appraiserCount = locationData?.appraisers?.length ?? 0;
  const expertLabel = appraiserCount === 1 ? 'Local Expert' : 'Local Experts';
  const appraiserLabel = appraiserCount === 1 ? 'appraiser' : 'appraisers';
  const tier1Title = (() => {
    const expertPhrase = `${appraiserCount} ${expertLabel}`;
    switch (validCitySlug) {
      case 'aspen':
        return `${citySearchName} Art Appraisers & Antique Appraisers | Compare ${expertPhrase}`;
      case 'seattle':
        return `${citySearchName} Art Appraisal Services | Compare ${expertPhrase}`;
      case 'des-moines':
        return `${citySearchName} Antique Appraisals & Antique Appraisers | Compare ${expertPhrase}`;
      case 'indianapolis':
        return `${citySearchName} Art Appraisers | Compare ${expertPhrase}`;
      case 'richmond':
        return `${citySearchName} Antique Appraisers | Compare ${expertPhrase}`;
      case 'jacksonville':
        return `${citySearchName} Art Appraisers | Compare ${expertPhrase}`;
      case 'honolulu':
        return `Oahu Antique Appraiser | Compare ${expertPhrase}`;
      case 'tucson':
        return `${citySearchName} Antique Appraisers | Compare ${expertPhrase}`;
      case 'orlando':
        return `${citySearchName} Antique Appraisers | Compare ${expertPhrase}`;
      case 'baltimore':
        return `Baltimore Antique Appraisers Near Me — Compare ${expertPhrase}`;
      case 'philadelphia':
        return `${citySearchName} Antique Appraisers | Compare ${expertPhrase}`;
      case 'cleveland':
        return `${citySearchName} Antique Appraiser | Compare ${expertPhrase}`;
      case 'columbus':
        return `Columbus, OH Antique Appraisers Near Me — Compare ${expertPhrase}`;
      case 'chicago':
        return `Antique Appraisers in ${citySearchName}, IL — Compare ${expertPhrase}`;
      case 'milwaukee':
        return `Milwaukee Antique Appraisers Near Me — Compare ${expertPhrase}`;
      default:
        return '';
    }
  })();
  const tier1Description = (() => {
    const countPrefix = appraiserCount > 0
      ? `Compare ${appraiserCount} ${citySearchName} antique and art ${appraiserLabel}`
      : `Find ${citySearchName} antique and art appraisers`;
    switch (validCitySlug) {
      case 'aspen':
        return `${countPrefix} for Aspen art appraisers and antique appraisers, including donation, estate, insurance, and personal-property reports. Review local experts and online options.`;
      case 'seattle':
        return `${countPrefix} for Seattle art appraisal services, donation, estate, insurance, and personal-property reports. Review local experts and online options.`;
      case 'indianapolis':
        return `${countPrefix}, including Indianapolis art appraisers for donation, estate, insurance, and personal-property reports. Review local experts and online options.`;
      case 'richmond':
        return `${countPrefix} for Richmond antique appraisers, donation, estate, insurance, and personal-property reports. Review local experts and online options.`;
      case 'jacksonville':
        return `${countPrefix}, including Jacksonville art appraisers for donation, estate, insurance, and personal-property reports. Review local experts and online options.`;
      case 'honolulu':
        return `${countPrefix} for Oahu antique appraiser and Honolulu valuation searches, plus donation, estate, insurance, and personal-property reports. Review local experts and online options.`;
      case 'columbus':
        return `${countPrefix}, including options for a Columbus art appraiser near you, plus donation, estate, insurance, and personal-property reports. Review local experts and online options.`;
      case 'milwaukee':
        return `${countPrefix} for antique appraisal Milwaukee searches near me, plus donation, estate, insurance, and personal-property reports. Review local experts and online options.`;
      case 'baltimore':
        return `${countPrefix} in Baltimore, Maryland for donation, estate, insurance, and personal-property reports. Review local experts and online options.`;
      case 'des-moines':
        return `${countPrefix} for Des Moines antique appraisals and Des Moines art appraisers, including donation, estate, insurance, and personal-property reports. Review local experts and online options.`;
      default:
        return `${countPrefix} for donation, estate, insurance, and personal-property reports. Review local experts and online options.`;
    }
  })();
  const fallbackSeoTitle = locationData?.appraisers?.length
    ? `${citySearchName} Antique Appraisers | Compare ${locationData.appraisers.length} Local Experts`
    : `${citySearchName} Antique Appraisers | Local & Online Options`;
  const fallbackSeoDescription = locationData?.appraisers?.length
    ? `Compare ${locationData.appraisers.length} antique appraisers in ${cityName} for estate, insurance, donation, resale, and personal-property needs. Review local specialties, then choose in-person service or a faster online written appraisal.`
    : `Find antique appraisers in ${cityName} for estate, insurance, donation, resale, and personal-property needs. Compare local providers and online appraisal options.`;
  const prioritySeoTitle = appraiserCount > 0
    ? (tier1Title || `${citySearchName} Antique Appraisers | Compare ${appraiserCount} ${expertLabel}`)
    : `${citySearchName} Antique Appraisers | Local & Online Options`;
  const prioritySeoDescription = appraiserCount > 0
    ? tier1Description
    : `Find ${citySearchName} antique and art appraisers for donation, estate, insurance, and personal-property reports. Compare local and online options.`;
  const seoTitle = seoOverride?.title ?? (isLowCtrPriorityCity ? prioritySeoTitle : fallbackSeoTitle);
  const seoDescription = seoOverride?.description ?? (isLowCtrPriorityCity ? prioritySeoDescription : fallbackSeoDescription);
  const heroHeading = seoOverride?.h1 ?? `${citySearchName} Antique Appraisers`;
  const heroDescription =
    seoOverride?.heroDescription ??
    `Compare local antique and art appraisers in ${cityName} for estate, insurance, donation, resale, and personal-property needs. Review specialties below, or skip the appointment cycle and start a faster online written appraisal. Note: these appraisers specialize in personal property (antiques, art, collectibles), not real estate or home appraisals.`;

  const generateLocationFaqSchema = () => {
    const baseFaqs = [
      {
        '@type': 'Question',
        name: `Where can I find antique appraisers near me in ${cityName}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `This directory lists antique appraisers serving ${cityName}. You can contact local providers directly or use Appraisily for a fast online antique appraisal alternative.`
        }
      },
      {
        '@type': 'Question',
        name: `Do you offer in-person appraisals in ${cityName}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Appraisily focuses on online appraisals. This directory lists local providers in ${cityName} so you can contact them directly, or use Appraisily for a fast online alternative.`
        }
      },
      {
        '@type': 'Question',
        name: `How much does an antique appraisal cost in ${cityName}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Antique appraisal costs in ${cityName} vary by provider and item complexity. Browse the appraisers above to compare pricing, or start an online appraisal with Appraisily for transparent upfront pricing.`
        }
      },
      {
        '@type': 'Question',
        name: `What should I look for in an antique appraiser near ${citySearchName}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Look for certified appraisers with expertise in your specific item type (furniture, jewelry, artwork, etc.), transparent pricing, and experience with your appraisal purpose (insurance, estate, donation, or resale).`
        }
      },
      {
        '@type': 'Question',
        name: 'How does an online appraisal work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Submit clear photos, measurements, and any provenance. Our experts review the item and deliver a written valuation report online.'
        }
      },
      {
        '@type': 'Question',
        name: 'How fast is the online appraisal turnaround?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Turnaround is typically faster than scheduling an in-person visit. Timing varies by item type and complexity.'
        }
      },
      {
        '@type': 'Question',
        name: 'What should I prepare before requesting an appraisal?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Provide multiple photos (front, back, details, marks), dimensions, condition notes, and any history or purchase information.'
        }
      },
      {
        '@type': 'Question',
        name: 'Can I choose between local and online options?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Yes. Use the local directory for in-person options in ${cityName}, or request an online appraisal from Appraisily for speed and convenience.`
        }
      },
      {
        '@type': 'Question',
        name: `Is this a home or real estate appraisal service in ${cityName}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `No. The appraisers listed in this directory specialize in personal property — antiques, fine art, collectibles, jewelry, and vintage items. For real estate or home appraisals in ${cityName}, you will need to contact a licensed real estate appraiser separately.`
        }
      }
    ];

    const citySpecificFaqs: Partial<Record<(typeof STRIKING_DISTANCE_CITY_SLUGS)[number], Array<{ '@type': string; name: string; acceptedAnswer: { '@type': string; text: string } }>>> = {
      'des-moines': [
        {
          '@type': 'Question',
          name: 'What antiques are most commonly appraised in Des Moines?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Des Moines estates frequently contain vintage John Deere collectibles, Iowa pottery (Red Wing, McCoy), mid-century modern furniture, Civil War artifacts from Iowa regiments, and rural folk art. These categories have strong regional collector demand.'
          }
        }
      ],
      chicago: [
        {
          '@type': 'Question',
          name: 'What types of antiques are unique to Chicago estates?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Chicago estates commonly feature Arts and Crafts furniture (Roycroft, Stickley), Chicago School architectural elements, WPA-era art, Prairie School design pieces, and immigrant folk art from Eastern European communities. Local auction houses like Hindman and Wright set national benchmarks for these categories.'
          }
        }
      ],
      philadelphia: [
        {
          '@type': 'Question',
          name: 'What makes Philadelphia antique furniture valuable?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Philadelphia Chippendale furniture is among the most valuable American furniture categories. Pieces with documented Philadelphia provenance from the 18th century can command extraordinary premiums at auction. Early American silver from Philadelphia silversmiths like Joseph Richardson and Philip Syng is also highly collected.'
          }
        }
      ],
      'new-orleans': [
        {
          '@type': 'Question',
          name: 'What antiques are unique to New Orleans?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'New Orleans estates contain French and Spanish colonial furniture, Creole decorative arts, Mardi Gras memorabilia, and pieces from the city\'s cotton and sugar industries. These items reflect the city\'s unique blend of French, Spanish, Creole, and Cajun cultural influences.'
          }
        }
      ],
      seattle: [
        {
          '@type': 'Question',
          name: 'What Native American crafts are found in Seattle estates?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Seattle estates frequently contain Pacific Northwest Native American crafts, particularly Tlingit, Haida, and Coast Salish pieces. Items with documented artist attribution carry significant premiums. Klondike Gold Rush memorabilia and Puget Sound maritime artifacts are also common finds.'
          }
        }
      ]
    };

    const additionalFaqs = citySpecificFaqs[validCitySlug as (typeof STRIKING_DISTANCE_CITY_SLUGS)[number]];
    if (additionalFaqs) {
      return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [...baseFaqs, ...additionalFaqs]
      };
    }

    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: baseFaqs
    };
  };
  const generateLocationCollectionSchema = () => ({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': locationCanonicalUrl,
    url: locationCanonicalUrl,
    name: seoTitle,
    description: seoDescription,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Antique Appraiser Directory',
      url: SITE_URL
    },
    about: {
      '@type': 'Thing',
      name: `Antique appraisal services in ${cityName}`
    },
    mainEntity: {
      '@type': 'ItemList',
      name: `Top antique appraisers in ${cityName}`,
      numberOfItems: locationData?.appraisers?.length ?? 0,
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      itemListElement: (locationData?.appraisers ?? []).slice(0, 20).map((appraiser, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: buildSiteUrl(`/appraiser/${appraiser.slug}`),
        name: appraiser.name
      }))
    }
  });

  const flaggedAppraisers = (locationData?.appraisers ?? []).filter(appraiser =>
    isTemplatedPricing(appraiser.business?.pricing) ||
    isTemplatedExperience(appraiser.business?.yearsInBusiness) ||
    isTemplatedNotes(appraiser.content?.notes, appraiser.address.city) ||
    hasPlaceholderName(appraiser.name) ||
    isPlaceholderAbout(appraiser.content?.about)
  );
  const showLocationWarning = flaggedAppraisers.length > 0;

  useEffect(() => {
    if (!locationData || locationData.appraisers.length === 0) {
      return;
    }

    trackEvent('location_page_summary', {
      city_slug: validCitySlug,
      city_name: citySearchName,
      state: cityMeta?.state,
      appraiser_count: locationData.appraisers.length,
      flagged_profile_count: flaggedAppraisers.length,
      related_city_count: relatedCities.length,
      top_specialties: topSpecialties.slice(0, 3),
      seo_variant: seoOverride ? 'location_near_you_v3_city_override' : 'location_near_you_v2'
    });
  }, [
    cityMeta?.state,
    citySearchName,
    flaggedAppraisers.length,
    locationData,
    relatedCities.length,
    seoOverride,
    topSpecialties,
    validCitySlug
  ]);

  const handleAppraiserCardClick = (appraiser: StandardizedAppraiser, placement: string) => {
    trackEvent('appraiser_card_click', {
      placement,
      appraiser_slug: appraiser.slug,
      appraiser_name: appraiser.name,
      city: appraiser.address.city,
      state: appraiser.address.state
    });
  };

  const handleLocationCtaClick = (placement: string) => {
    trackEvent('cta_click', {
      placement,
      destination: primaryCtaUrl,
      city_slug: validCitySlug
    });
  };
  const handleRelatedCityClick = (relatedCity: DirectoryCity, placement: string) => {
    trackEvent('related_city_click', {
      placement,
      city_slug: validCitySlug,
      city_name: citySearchName,
      related_city_slug: relatedCity.slug,
      related_city_name: relatedCity.name,
      related_city_state: relatedCity.state,
    });
  };
  const scrollToLocalAppraisers = () => {
    const target = document.getElementById('local-appraisers');
    if (!target) return;
    const nav = document.querySelector('nav');
    const navHeight = nav instanceof HTMLElement ? nav.offsetHeight : 0;
    const offset = navHeight + 16;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  };
  const handleSearchThemeClick = (theme: string) => {
    trackEvent('search_theme_click', {
      placement: 'location_search_themes',
      city_slug: validCitySlug,
      city_name: citySearchName,
      search_theme: theme
    });
    scrollToLocalAppraisers();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}#local-appraisers`
    );
  };

  const handleSpecialtyTagClick = (specialty: string) => {
    const next = selectedSpecialty === specialty ? null : specialty;
    setSelectedSpecialty(next);
    trackEvent('specialty_tag_click', {
      placement: 'location_appraiser_card',
      city_slug: validCitySlug,
      city_name: citySearchName,
      specialty,
      active: next !== null
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 mt-16">
        <h1 className="text-2xl font-bold mb-4">Loading {cityName} Antique Appraisers...</h1>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="border rounded-lg p-4">
                <div className="h-40 bg-gray-200 rounded mb-4" />
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !locationData || !locationData.appraisers || locationData.appraisers.length === 0) {
    const isNotFound = error === 'not_found';

    if (isNotFound) {
      return (
        <>
          <SEO
            title="Page Not Found | Antique Appraiser Directory"
            description="The antique appraiser page you're looking for doesn't exist. Browse our directory to find certified antique appraisers near you."
            schema={[generateBreadcrumbSchema()]}
            path={locationPath}
            pageUrl={locationCanonicalUrl}
            noIndex
          />
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg focus:outline-none focus:text-blue-700"
          >
            Skip to main content
          </a>
          <div className="container mx-auto px-4 py-8 mt-16">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">404</p>
              <h1 className="text-3xl font-bold mb-4">Location Not Found</h1>
              <p className="text-gray-600 mb-6">
                We couldn't find antique appraisers for the location you requested.
                Browse our full directory to find certified antique appraisers near you.
              </p>
              <a
                href={SITE_URL}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-white shadow-md hover:bg-primary/90 transition-colors"
              >
                Browse All Locations
              </a>
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <SEO
          title={`Antique Appraisers in ${cityName} | Find Local Antique Appraisal Services`}
          description={`We're currently updating our list of antique appraisers in ${cityName}. Browse our directory for other locations or check back soon.`}
          schema={[generateBreadcrumbSchema()]}
          path={locationPath}
          pageUrl={locationCanonicalUrl}
        />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg focus:outline-none focus:text-blue-700"
        >
          Skip to main content
        </a>
        <div className="container mx-auto px-4 py-8 mt-16">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl font-bold mb-4">Antique Appraisers in {cityName}</h1>
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-6 py-4 rounded-lg mb-6">
              <p className="font-medium">We're currently updating our database of antique appraisers in {cityName}.</p>
              <p className="mt-2">Please check back soon or explore other cities in our directory.</p>
            </div>
            <a href={SITE_URL} className="text-blue-600 hover:underline font-medium">
              Browse all locations
            </a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO
        title={seoTitle}
        description={seoDescription}
        keywords={seoKeywords}
        schema={[
          generateLocationSchema(locationData, cityName, validCitySlug),
          generateBreadcrumbSchema(),
          generateLocationCollectionSchema(),
          generateLocationFaqSchema()
        ]}
        path={locationPath}
        pageUrl={locationCanonicalUrl}
        geoCity={citySearchName}
        geoRegion={cityMeta?.state || 'US'}
        geoPosition={cityMeta?.latitude && cityMeta?.longitude ? `${cityMeta.latitude};${cityMeta.longitude}` : undefined}
      />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg focus:outline-none focus:text-blue-700"
      >
        Skip to main content
      </a>
      <div className="container mx-auto px-4 py-8 mt-16">
        <div id="main-content" className="max-w-6xl mx-auto">
        <div className="bg-gradient-to-r from-blue-50 to-white p-6 rounded-lg mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold text-blue-700 mb-2">Compare local appraisers or start online</p>
              <h1 className="text-3xl font-bold mb-3">{heroHeading}</h1>
              <p className="text-gray-600">{heroDescription}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={primaryCtaUrl}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-3 text-white font-semibold hover:bg-blue-700 transition-colors"
                data-gtm-event="cta_click"
                data-gtm-placement="location_hero_primary"
                onClick={() => handleLocationCtaClick('location_hero_primary')}
              >
                Start online written appraisal
              </a>
              <a
                href="#local-appraisers"
                className="inline-flex items-center justify-center rounded-md border border-blue-200 px-5 py-3 text-blue-700 font-semibold hover:bg-blue-50 transition-colors"
                data-gtm-event="cta_click"
                data-gtm-placement="location_hero_secondary"
                onClick={(event) => {
                  trackEvent('cta_click', {
                    placement: 'location_hero_secondary',
                    destination: '#local-appraisers',
                    city_slug: validCitySlug
                  });
                  event.preventDefault();
                  scrollToLocalAppraisers();
                  window.history.replaceState(
                    null,
                    '',
                    `${window.location.pathname}${window.location.search}#local-appraisers`
                  );
                }}
              >
                Compare local appraisers
              </a>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700">
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <p className="font-semibold text-gray-900 mb-1">Estate, insurance, and donation use cases</p>
              <p>Find appraisers who handle the documentation needs people most often search for in {cityName}.</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <p className="font-semibold text-gray-900 mb-1">Local specialists by city and niche</p>
              <p>Browse providers serving {cityName} and nearby areas, then shortlist by specialty fit.</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <p className="font-semibold text-gray-900 mb-1">Faster online option</p>
              <p>Skip scheduling friction and start an online written appraisal when speed matters more than an in-person visit.</p>
            </div>
          </div>
        </div>

        {cityGuide && (
          <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 sm:p-8">
            <h2 className="text-xl font-semibold mb-4">Antique Appraisal Guide for {citySearchName}</h2>
            <div className="space-y-6 text-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{citySearchName} Antique Market Overview</h3>
                <p className="leading-relaxed">{cityGuide.marketOverview}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Commonly Appraised Items in {citySearchName}</h3>
                <p className="leading-relaxed">{cityGuide.commonItems}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{citySearchName} Antique Scene &amp; Events</h3>
                <p className="leading-relaxed">{cityGuide.localScene}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Appraisal Tips for {citySearchName} Collectors</h3>
                <p className="leading-relaxed">{cityGuide.appraisalTips}</p>
              </div>
            </div>
          </div>
        )}

        {locationData?.appraisers?.length > 0 && (
          <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-xl font-semibold mb-2">{citySearchName} appraisal snapshot</h2>
            <p className="text-gray-600">
              We currently list {locationData.appraisers.length} antique {appraiserLabel} in {cityName}.
              {topSpecialties.length > 0 && ` Common specialties include ${topSpecialties.join(', ')}.`}
              {' '}Use this page to compare local options first, then move online if you need a faster written report.
            </p>
          </div>
        )}

        {locationSearchThemes.length > 0 && (
          <div className="mb-8 rounded-lg border border-blue-100 bg-white p-6">
            <h2 className="text-xl font-semibold mb-2">Common appraisal searches in {citySearchName}</h2>
            <p className="text-gray-600">
              People usually reach this page while comparing local options for donation, estate, insurance, and resale needs.
              These are the most common search phrases we are aligning this city page to:
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {locationSearchThemes.map((theme) => (
                <button
                  type="button"
                  key={theme}
                  className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-100 transition-colors relative z-0 cursor-pointer"
                  onClick={() => handleSearchThemeClick(theme)}
                  aria-label={`Jump to ${citySearchName} appraisers for ${theme}`}
                >
                  {theme}
                </button>
              ))}
            </div>
          </div>
        )}

        {relatedCities.length > 0 && (
          <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-xl font-semibold mb-2">
              More antique appraisal directories near {cityMeta?.state || citySearchName}
            </h2>
            <p className="text-gray-600">
              Build your shortlist faster by checking nearby city directories and comparing additional specialists.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {relatedCities.map(city => (
                <a
                  key={city.slug}
                  href={buildSiteUrl(`/location/${city.slug}`)}
                  className="inline-flex items-center rounded-full border border-blue-200 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 relative z-0"
                  data-gtm-event="related_city_click"
                  data-gtm-placement="location_related_cities"
                  data-gtm-city={city.slug}
                  onClick={() => handleRelatedCityClick(city, 'location_related_cities')}
                >
                  {city.name}, {city.state}
                </a>
              ))}
            </div>
          </div>
        )}

        {prioritizedInternalLinkCities.length > 0 && (
          <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-xl font-semibold mb-2">Compare appraiser guides people also check from {citySearchName}</h2>
            <p className="text-gray-600">
              Use these city pages to compare provider options, specialties, and availability before choosing local or online appraisal support.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {prioritizedInternalLinkCities.map(city => (
                <a
                  key={city.slug}
                  href={buildSiteUrl(`/location/${city.slug}`)}
                  className="inline-flex items-center rounded-full border border-blue-200 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 relative z-0"
                  data-gtm-event="related_city_click"
                  data-gtm-placement="location_priority_links"
                  data-gtm-city={city.slug}
                  onClick={() => handleRelatedCityClick(city, 'location_priority_links')}
                >
                  {city.name} appraisers ({city.state})
                </a>
              ))}
            </div>
          </div>
        )}

        {popularOpportunityCities.length > 0 && (
          <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-xl font-semibold mb-2">Popular antique appraisal city guides</h2>
            <p className="text-gray-600">
              Compare nearby options with other high-demand appraisal cities collectors search most often.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {popularOpportunityCities.map(city => (
                <a
                  key={city.slug}
                  href={buildSiteUrl(`/location/${city.slug}`)}
                  className="inline-flex items-center rounded-full border border-blue-200 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 relative z-0"
                  data-gtm-event="related_city_click"
                  data-gtm-placement="location_popular_cities"
                  data-gtm-city={city.slug}
                  onClick={() => handleRelatedCityClick(city, 'location_popular_cities')}
                >
                  {city.name}, {city.state}
                </a>
              ))}
            </div>
          </div>
        )}

        {showLocationWarning && (
          <div className="mb-8 rounded-lg border border-yellow-300 bg-yellow-50 px-5 py-4 text-sm text-yellow-900">
            <p className="font-semibold mb-1">We&rsquo;re still polishing a few profiles in this city.</p>
            <p>
              {flaggedAppraisers.length} of {locationData.appraisers.length} listings still use templated copy for pricing or experience.
              We&rsquo;re working with our research team to swap in verified details. If you spot something off, let us know at{' '}
              <a className="underline" href="mailto:info@appraisily.com">
                info@appraisily.com
              </a>
              .
            </p>
          </div>
        )}

        <div className="mb-10 rounded-lg border border-blue-100 bg-blue-50/60 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="max-w-3xl">
              <h2 className="text-xl font-semibold mb-2">Online vs. in-person appraisal in {cityName}</h2>
              <p className="text-gray-600">
                Many people searching for an in-person appraisal prefer the speed and convenience of online reviews.
                Use the comparison below to decide what fits your situation.
              </p>
            </div>
            <a
              href={primaryCtaUrl}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-3 text-white font-semibold hover:bg-blue-700 transition-colors"
              data-gtm-event="cta_click"
              data-gtm-placement="location_comparison"
              onClick={() => handleLocationCtaClick('location_comparison')}
            >
              Get an online appraisal
            </a>
          </div>
          <div className="mt-6 overflow-hidden rounded-lg border border-blue-100 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 text-sm">
              <div className="border-b md:border-b-0 md:border-r border-blue-100 p-4">
                <p className="font-semibold text-gray-900 mb-2">Local in-person</p>
                <ul className="space-y-2 text-gray-600">
                  <li>Schedule a visit and meet on site</li>
                  <li>Ideal for large collections or complex items</li>
                  <li>Timing depends on local availability</li>
                </ul>
              </div>
              <div className="p-4">
                <p className="font-semibold text-gray-900 mb-2">Appraisily online</p>
                <ul className="space-y-2 text-gray-600">
                  <li>No appointment required</li>
                  <li>Submit photos and details from anywhere</li>
                  <li>Faster turnaround for most items</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div id="local-appraisers" className="mb-6 scroll-mt-20">
          <h2 className="text-2xl font-semibold">Local antique appraisers in {cityName}</h2>
          <p className="text-gray-600 mt-2">
            Use this list to contact in-person providers or compare them with Appraisily&rsquo;s online option.
          </p>
        </div>

        {topReviewedAppraisers.length > 0 && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-xl font-semibold mb-2">Top-reviewed appraisers in {cityName}</h2>
            <p className="text-gray-600">
              Start with the highest-reviewed profiles, then compare specialties and service fit.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {topReviewedAppraisers.map((appraiser) => (
                <a
                  key={appraiser.id}
                  href={buildSiteUrl(`/appraiser/${appraiser.slug}`)}
                  className="inline-flex items-center rounded-full border border-blue-200 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 relative z-0"
                  data-gtm-event="appraiser_card_click"
                  data-gtm-placement="location_top_reviewed"
                  data-gtm-appraiser={appraiser.slug}
                  onClick={() => handleAppraiserCardClick(appraiser, 'location_top_reviewed')}
                >
                  {appraiser.name} ({appraiser.business.reviewCount} reviews)
                </a>
              ))}
            </div>
          </div>
        )}

        {selectedSpecialty && (
          <div className="mb-4 flex items-center gap-2 text-sm">
            <span className="text-gray-600">Showing appraisers for:</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-800">
              {selectedSpecialty}
              <button
                type="button"
                className="ml-1 text-blue-600 hover:text-blue-800 focus:outline-none"
                onClick={() => setSelectedSpecialty(null)}
                aria-label="Clear specialty filter"
              >
                &times;
              </button>
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {locationData.appraisers
            .filter(appraiser => {
              if (!selectedSpecialty) return true;
              return appraiser.expertise.specialties.includes(selectedSpecialty);
            })
            .map(appraiser => {
            const appraiserUrl = buildSiteUrl(`/appraiser/${appraiser.slug}`);
            return (
            <div
              key={appraiser.id}
              className="block border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow focus-within:ring-2 focus-within:ring-blue-300"
              data-gtm-appraiser={appraiser.slug}
            >
              <a
                href={appraiserUrl}
                className="block text-inherit no-underline"
                data-gtm-event="appraiser_card_click"
                data-gtm-appraiser={appraiser.slug}
                data-gtm-placement="location_results"
                onClick={() => handleAppraiserCardClick(appraiser, 'location_results')}
                aria-label={`View ${appraiser.name} profile`}
              >
                <div className="h-48 bg-gray-200 overflow-hidden">
                  <img
                    src={normalizeAssetUrl(appraiser.imageUrl)}
                    alt={`${appraiser.name} - Antique Appraiser in ${appraiser.address.city}`}
                    className="w-full h-full object-cover transition-transform hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = DEFAULT_PLACEHOLDER_IMAGE;
                    }}
                  />
                </div>

                <div className="p-4">
                  <h2 className="text-xl font-semibold mb-2 text-gray-900">
                    {appraiser.name}
                  </h2>

                  <div className="flex items-center text-sm text-gray-600 mb-2">
                    <MapPin className="h-4 w-4 mr-1 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{appraiser.address.formatted}</span>
                  </div>

                  {appraiser.business.reviewCount > 0 && appraiser.business.rating > 0 ? (
                    <div className="flex items-center mb-3">
                      <div className="flex items-center">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span className="ml-1 text-gray-700">{appraiser.business.rating.toFixed(1)}</span>
                      </div>
                      <span className="text-sm text-gray-500 ml-2">
                        ({appraiser.business.reviewCount} reviews)
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 mb-3">Reviews not available</div>
                  )}

                  <div className="space-y-2 mb-4">
                    <div className="flex flex-wrap gap-1">
                      {appraiser.expertise.specialties.slice(0, 3).map((specialty) => {
                        const isActive = selectedSpecialty === specialty;
                        return (
                          <button
                            key={specialty}
                            type="button"
                            className={[
                              'inline-block rounded-full px-2 py-0.5 text-xs mb-1 transition-colors',
                              'cursor-pointer hover:bg-blue-100 focus:outline-none focus:ring-1 focus:ring-blue-300',
                              isActive ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700'
                            ].join(' ')}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSpecialtyTagClick(specialty);
                            }}
                            aria-pressed={isActive}
                            aria-label={`Filter by ${specialty}${isActive ? ' (active)' : ''}`}
                          >
                            {specialty}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                    <span className="text-blue-600 text-sm font-medium inline-flex items-center">
                      View Profile
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 ml-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
              </a>
            </div>
          );
          })}
        </div>

        {locationData.appraisers.filter(appraiser => {
          if (!selectedSpecialty) return true;
          return appraiser.expertise.specialties.includes(selectedSpecialty);
        }).length === 0 && (
          <div className="text-center py-8">
            {selectedSpecialty ? (
              <>
                <p className="text-gray-600">No appraisers found for &ldquo;{selectedSpecialty}&rdquo; in {cityName}.</p>
                <button
                  type="button"
                  className="mt-3 text-blue-600 hover:underline text-sm font-medium"
                  onClick={() => setSelectedSpecialty(null)}
                >
                  Clear filter to see all appraisers
                </button>
              </>
            ) : (
              <p className="text-gray-600">No antique appraisers found in {cityName} yet. Check back soon!</p>
            )}
          </div>
        )}

        <div className="mt-10 rounded-lg border border-purple-100 bg-purple-50/60 p-6">
          <h2 className="text-xl font-semibold mb-2">Looking for art-specific appraisers in {cityName}?</h2>
          <p className="text-gray-600 mb-4">
            Our Art Appraisers Directory focuses on fine art, paintings, prints, and sculpture valuations.
            Browse art specialists in {cityName} for donation, estate, and insurance appraisals.
          </p>
          <a
            href={`https://art-appraisers-directory.appraisily.com/location/${validCitySlug}/`}
            className="inline-flex items-center text-purple-700 hover:text-purple-900 font-medium"
          >
            View {citySearchName} art appraisers
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 ml-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        </div>

        <div className="mt-12 bg-gray-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-3">Need an appraisal without the wait?</h2>
          <p className="text-gray-600 mb-4">
            Appraisily delivers expert online valuations backed by research and market data. Start online, then decide if you still
            need an in-person visit.
          </p>
          <a
            href={primaryCtaUrl}
            className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
            data-gtm-event="cta_click"
            data-gtm-placement="location_footer"
            onClick={() => handleLocationCtaClick('location_footer')}
          >
            Request an online appraisal
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 ml-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        </div>

        <div className="mt-10 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-xl font-semibold mb-4">FAQ for {cityName} appraisals</h2>
          <div className="space-y-4 text-gray-600">
            <div>
              <p className="font-semibold text-gray-900">Do you offer in-person appraisals in {cityName}?</p>
              <p>
                Appraisily focuses on online appraisals. Use the local directory to contact in-person providers, or get a fast
                online alternative with Appraisily.
              </p>
            </div>
            <div>
              <p className="font-semibold text-gray-900">How does an online appraisal work?</p>
              <p>Share photos, measurements, and any provenance. Our experts review the item and deliver a written valuation.</p>
            </div>
            <div>
              <p className="font-semibold text-gray-900">What should I prepare before requesting an appraisal?</p>
              <p>Multiple photos, condition notes, dimensions, and any labels, signatures, or purchase history help the most.</p>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Can I still use a local appraiser?</p>
              <p>Yes. Start with the directory above if you want in-person services in {cityName}.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
