const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

// Import models
const User = require('../models/User');
const Neighbourhood = require('../models/Neighbourhood');
const ChatGroup = require('../models/ChatGroup');
const Notice = require('../models/Notice');
const Report = require('../models/Report');
const Message = require('../models/Message');

const connectDB = require('../config/database');

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting enhanced database seeding...');
    
    // Connect to MongoDB
    await connectDB();
    
    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await User.deleteMany({});
    await Neighbourhood.deleteMany({});
    await ChatGroup.deleteMany({});
    await Notice.deleteMany({});
    await Report.deleteMany({});
    await Message.deleteMany({});
    
    // Create a sample neighbourhood
    console.log('Creating sample neighbourhood...');
    const neighbourhood = new Neighbourhood({
      name: 'Oak Strety',
      descriptionmmunity',
      address: '123 Oareet',
      city: 'Springfield',
      stL',
      zipCode: '62701',
      country: 'USA',
      location: {
       'Point',
    tes
      },
      radiusMeters: 1000,
    ue,
      createdBy: new mongoed
    });
    
    await neighbourhood.save();
    console.log('✅ Neighbourhood created');
    
    // Create sample users
    console.log('👥 Creat;
    
    // Admin user
    const adminUser = new User({
      email: 'admin@om',
      password: 'admin1
      firstName: 'Admin',
      l
    
      address: '123 Oak Str',
      role: 'admin',
    
      neighbourhoodId: neighbourhood._id
    });
    
    );
    console.log('✅ Adil);
    
    // Update neighbourhood createdBy
    neighbourhood.createdBy = adminUser._id;
    await neighbourhood.save();
    
    // Moderator user
    const moderatorUser = new Us
      email: 'moderator@om',
      password: 'mod123',
      firstName: 'Moderator',
      l',
    -0002',
      address: '125 Oak Street'
      role: 'moderator',
      isActive: true,
      neighbourhoodId: neighbourhood._id
    });
    
    await moderatorUser.save();
    console.log('✅ Moderator
    
    // Regular users
    const usersData = [
      {
        email: 'john.
        password: 'user12
        firstName: 'John',
        ,
       
        address: '127 Oak Street',
        role: 'user',
        isVerified: true,
        neighbourhoodId: neighbourhood._id
      },
      {
        email: 'jane.
        password: 'user12
        firstName: 'Jane',
        h',
       
        address: '129 Oak Street',
        role: 'user',
        isVerified: true,
        neighbourhoodId: neighbourhood._id
      },
      {
        email: 'mike..com',
        password: 'user123',
        firstName: 'Mike',
       n',
      
    
        role: 'user',
        isVerified: false,
        neighbourhoodId: neighbourhood._id
      },
     
    l.com',
        password: 'user123',
        firstName: 'Sarah',
        lastName: 'Wilson',
        phone: '+1-555-0006',
        address: '133 Oak Street',
        role: 'user',
        isVerified: true,
        neighbourhoodId: neighbourhood._id
      },
      {
        email: 'david.brown@email.com',
       r123',
       ,
    ,
        phone: '+1-555-0007',
        address: '135 Oak Street',
    
        isVerified: true,
        neighbourhoodId: neighbourhood._id
      }
    ];
    
    const createdUsers = [];
    for (const userData of usersData) {
    
      await user.sav();
    
      console.log('
    }
    
   oups
  
[
      {
        name: 'ase();seedDatabeding
the se Run };

//
  }
exit(1);    process. error);
',ase:ing databrror seed'❌ Ee.error(   consol
 or) {errcatch (
  } 
    xit(0); process.e  
   s');
   Messageg('- 6lo  console.orts');
  og('- 5 Rep console.l  tices');
 - 6 Noog('nsole.l
    coat Groups');Ch 3 nsole.log('-co  ers)');
   us, 4 regularderatorins, 1 mo adm (2- 7 Usersole.log('ons
    cood');Neighbourh('- 1 e.log   consold:');
  Data createe.log('\n📊  consol
  3');12serail.com / uid.brown@eml.com, davn@emaiah.wilso sarg('Users:sole.lo
    con user123');@email.com /mike.johnson.com, ith@emailom, jane.smail.chn.doe@emg('Users: joonsole.lo  c;
  / mod123')m od.coneighbourhor@todera mor:Moderatoe.log('olcons;
    ]')ed[encrypt.com / terson@gmailseandylanpatl Admin: g('Speciae.losol  con123');
  dmin.com / ahbourhoodn@neign: admile.log('Admi conso;
   eated:')ccounts crple a('\n📋 Samsole.log');
    consfully!espleted succeeding come snced databas'\n🎉 Enhale.log(nso    co
    
min.email); specialAded:',eatser crl admin upeciae.log('✅ Sol cons();
   lAdmin.savewait specia   a
  });
   104Z')
7.T22:47:5025-07-16'2ate(new DpdatedAt:    u  ,
 :50.415Z')6T21:5025-07-120: new Date('createdAt,
      gs: {}      settinod._id,
hod: neighboreighborhoodI     n: true,
 sActive
      ie,fied: tru      isVeri: 'admin',
role
      h Africa',eng, Soutenoni, Gautddress: 'B
      a9884235',064ne: '
      phoatterson',me: 'P    lastNa'Sean',
  stName: ,
      firm'R6rnjaCwFqJalH6DjSi6P3v.n.zm0y9Hl5pSmbRv3MsJVM12c2a$12$nvjd: '$ passwor     mail.com',
son@gatterseandylanpil: ' ema
     77b'),f6313ef4e181eba6c4Id('687s.ObjectTypeongoose.: new m   _idser({
    Umin = newAdnst special);
    coser...'dmin u ading special Ade.log('👑
    consolin userspecial adm/ Add the    /  }

 ted');
  sage creaog('✅ Mesle.l conso);
     ave(t message.s     awaita);
 Dage(messageessa = new Messagest m
      conessages) {Data of mmessageor (const 
    f;

    ]'
      }Type: 'textessage m   e.',
    ting everyon to meeorwardy! Looking fs Saturdaty BBQ thinit the commuout abforget: 'Don\'t       conten_id,
  ser.torUrId: modera sende      p._id,
 GroueneralpId: g    grou{
    
      
      },text'Type: '  message  ch!',
    ou so mua. Thank yk areark the pwill chec I Fluffy.ike unds l That sontent: 'Yes!      co_id,
  dUsers[0].ateId: crender    se   p._id,
  generalGroupId:   grou{
     },
          text'
  sageType: '
        mesFluffy?',d that be PM. Coul 6  aroundayrdark yesteear the pt n caan orange: 'I saw tenton   c    ,
 ]._iddUsers[1eate: crerId        send._id,
generalGroupd:      groupI
         { },

     pe: 'text'geTy   messa
     ',here too.d ask woul thought I he board buton t notice ed a I postat Fluffy?my c seen as anyoneontent: 'H,
        cers[0]._idedUsd: creatderI       sen
 lGroup._id,raene: gpId       grou
  {  },
        ext'
 'tpe:  messageTy.',
       onen with everymmunicatioof coct line ng a direate havicily appreis up! Realr setting th foent: 'Thanks   cont
     er._id,rUsratoderId: mode sen    id,
   p._eneralGrou groupId: g  {
       },
      text'
    : ' messageType    r.',
   otheut for each nd look o aconnectedy to stay  a great wa is! This chathood neighbouryone to ourlcome evertent: 'We        con,
idnUser._derId: admi       senid,
 roup._: generalG     groupId      {
   
ges = [onst messa    c
    
 Discussion/ General /ups[0];atedChatGrolGroup = creenera    const gges...');
mple messating sa💬 Crea.log('  console
  ple messagessam// Create 
      }

  le);rt.titated:', repoeport cre Role.log('✅    cons
  rt.save();wait repoa);
      a(reportDat Reportreport = new   const 
   ts) { reporrtData of (const repo;

    for  }
    ]'
    openstatus: '     _id,
   Users[3].rId: createdorterep        hood._id,
ighbor: neorhoodIdghb      nei,
  rea' }ak Street address: 'On: { alocatio        'medium',
ority:         priets',
'pry: catego      ay.',
  r than str lost rathe. May beas no collarl-fed but hars welAppeowner. hout rhood witeighboudering the ndog wanfriendly Large scription: '  de      
',odbourhoeighay Dog in Nle: 'Str tit
           {
      },ved'
  resoltus: '    sta,
    er._ideratorUsrterId: mod repo     od._id,
   neighborhohoodId:  neighbor     },
  ary'ntgfield ElemeSprinr  Road, neaainress: 'M { add location:
       h', 'higority:ri      pe',
  aintenanc 'm category:',
       ate repair.mmedi. Needs itire damaged eportents have rreside. Several vehiclesamage to g d is causinentranceool the schhole near ote p 'Largcription:       des
 Main Road',on thole rge Poe: 'Laitl       t   {
    },
 '
     : 'opentus      sta
  ser._id,inUrterId: admepo   rid,
     hborhood._eigrhoodId: n neighbo
        #67' },sear hou net,e Strees: 'Pinddresion: { a locat
       ty: 'high',priori       
 rity',: 'secutegory       ca.',
 o windowsnting is and lookng car doorsly, checkisuspicioun acting nts seeupaeet. Occe Str on Pinveral daysarked for seedan) park sle (dwn vehiction: 'Unkno  descrip  
    e Parked',clcious VehiSuspi '  title:{
             },
ting'
     vestiga status: 'inid,
       sers[2]._d: createdUrterI   repo  _id,
   ighborhood.: nehborhoodId neig },
       45' #, House 'Elm Streetress:tion: { add       locaw',
 : 'lority        priooise',
tegory: 'n
        ca affected.',le residents Multiprhood.he neighbouisturbs tnd dmidnight at nues pasMusic contit.  Streese on Elmrom houy weekend fs ever and partieLoud musiciption: '    descrties',
     - Loud ParComplaintNoise e: '  titl {
        },
         'open'
tus: sta        ]._id,
dUsers[1reateId: cteror      rep  ,
ood._idd: neighborhborhoodI    neigh    tion' },
 intersecoadain RStreet & M'Oak s: on: { addresocati  l    edium',
  priority: 'm        
aintenance',ry: 'matego     c
   tention.',immediate at needs a week andver r oen out fobeight has  l night. Thety hazard atafeting a sng, crea worki is notereet cornt on Oak Strtreet ligh: 'Sonescripti   d   ',
  reet Lighten St 'Brok   title:          {

  = [ortsep const r.');
   e reports..ting samplg('🚨 Crea  console.loeports
  ple ram s // Create  }

   e);
  e.titl, noticeated:'crice  Not.log('✅sole con;
     e.save()noticawait ta);
      ice(noticeDa Notice = newotnst n  co
    es) { noticData oficeonst not  for (c
  
    ];
    }  _id
ers[1].Usd: createdhorI        autood._id,
ighborhodId: neghborhoei      n: 'low',
  tyriori        pal',
gory: 'generte
        cace issues.',enan any maintportn and reung childresupervise yoe  Pleasy.dren to enjor chilow open fois na The arerk. nity pacommued at the een installipment has bnd equew playgroureat news! Ntent: 'Gcon',
        mentground Equip'New Play     title:    {
   ,
       }
  User._idmoderator  authorId:    od._id,
   eighborhod: noodIghborh        nei 'normal',
ty:ri    priot',
    ory: 'even     categ
   ,welcome!'ts  All residens.leedu patrol schand plconcerns ancurity nt secuss receisl dter. We wilenmmunity c the coat 7 PM y athis Thursdag twatch meetinod ighbourhoonthly necontent: 'M
        eeting',hood Watch MNeighboure: '        titl
},
      {   
   nUser._idId: admi      author._id,
  odhoeighbor nghborhoodId:
        neil',rma: 'noriority        pe',
ancen 'maintegory:       catean!',
 hood clur neighboureeping or kou foank yThickets.  to avoid tcleshiour vease move yleweek. Png next rtiM sta AM to 12 Py from 8Tuesda every ll now occur wileaningreet c: 'St   content   ',
  ate Upd ScheduleCleaning: 'Street       title   {
    },
   _id
    dUsers[0].reate authorId: c
       ._id,hborhoodd: neigodI neighborho
       mal',y: 'norpriorit,
        nd': 'lost_fou category      !',
 d offeredrewar if found - ase contact Pled.microchippe Fluffy is ning.esday evereet on Tur Elm Stseen neaast h bell. Lar witblue collwearing y, ry friendlbby cat, vetange Ora  content: '    y',
   Cat - Fluff: 'Lost      title    {
  ,
   }
     ue trPinned:       isser._id,
 rId: adminU      autho,
  od._id neighborhohoodId:eighbor n
       h',iority: 'hig   pr     fety',
saegory: '  cat,
      ach other.' for e look outant andStay vigily. immediatelies l authoritntact locaual, cousthing unyou see any AM. If d 20 PM anet between 1reed on Oak Sty reportivitpicious actsusbe aware of : 'Please nt  conte
      lert',s Activity A'Suspicioule:  tit      {
 
      
      },trueinned: isP       r._id,
 eratorUseorId: mod  auth
      ,rhood._idghboId: neirhoodneighbo     
   y: 'normal',iorit    pr,
    t': 'evenategory c
       ',t company.and grea games, ls,e grilav hllwiends! We d friily anyour famk. Bring y parommunite cM in thurday at 2 Pis SatBQ thcommunity Bonthly for our mJoin us ontent: '      ckend',
  This Weemmunity BBQ title: 'Co         {
    [
  ices =ott n
    cons);otices...'ing sample n('📢 Creat console.logs
   ple noticereate sam
    // C  }
me);
  tGroup.nahaed:', cgroup creatg('✅ Chat   console.lo
    tGroup);sh(chas.putGroupha    createdC;
  ve()p.saatGrouit chawa     upData);
 tGroup(grow Cha= net chatGroup cons      ups) {
of chatGrota upDaonst groor (c
    fs = [];roupedChatGt creat

    cons
    ]; }           ]
}
  : 'member' id, roledUsers[3]._reate { userId: c       er' },
  le: 'membs[2]._id, roatedUserrId: cre{ use         admin' },
 e: 'id, rolr._ratorUsed: mode { userI         s: [
member    
    User._id,tormodera:  createdBy
       ._id,hoodbord: neighoodI  neighborh     
 lic',ype: 'pub t      
 s',urhood evente neighboizrgancription: 'O des   ,
    nts'munity Eveom   name: 'C         {
    },
     ]
  }
     erator' 'mod role: r._id,moderatorUse userId:        {min' },
   ole: 'ad rr._id,d: adminUse  { userI         [
ers: memb
       User._id,intedBy: adm creaid,
       ghborhood._dId: neineighborhoo        
ncement',ype: 'annou,
        ttions'ificat safety notortanption: 'Impdescri        Alerts',
ety Safname: '
        
      {  },]
       r' }
     beole: 'memid, rdUsers[1]._rId: create      { use   
 r' },e: 'membe._id, rolsers[0] createdUserId:        { u  },
oderator' , role: 'mUser._id: moderatorrIduse     { 
     admin' }, role: 'd,._i: adminUser { userId      bers: [
         mem,
  ser._iddminUreatedBy: a       cod._id,
 hoId: neighborhborhoodneig        
blic',pu     type: 'sion',
   ity discuscommun: 'General scription        dession',
al DiscunerGe