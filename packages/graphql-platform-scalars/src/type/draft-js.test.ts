import { describe, expect, it } from '@jest/globals';
import { GraphQLDraftJS, type RawDraftContentState } from './draft-js.js';

describe('DraftJS', () => {
  it.each<[input: any, error: string]>([
    ['', 'Expects a plain-object, got: '],
    [' ', 'Expects a plain-object, got: '],
    [' \n \t ', 'Expects a plain-object, got: '],
    [
      {
        blocks: [],
        entityMap: {
          myInvalidKey: {
            type: 'LINK',
            mutability: 'MUTABLE',
            data: { path: '/home' },
          },
        },
      },
      "/entityMap/myInvalidKey - Expects an integer, got: 'myInvalidKey'",
    ],
    [
      {
        blocks: [
          {
            key: 'abc',
            type: 'unstyled',
            text: 'abcde',
            depth: 0,
            inlineStyleRanges: [],
            entityRanges: [{ key: 'myInvalidKey', offset: 0, length: 5 }],
          },
        ],
        entityMap: {
          5: {
            type: 'LINK',
            mutability: 'MUTABLE',
            data: { path: '/home' },
          },
        },
      },
      "/blocks/0/entityRanges/0/key - Expects an integer, got: 'myInvalidKey'",
    ],
    [
      {
        blocks: [
          {
            key: 'abc',
            type: 'unstyled',
            text: 'abcde',
            depth: 0,
            inlineStyleRanges: [],
            entityRanges: [{ key: 1, offset: 0, length: 5 }],
          },
        ],
        entityMap: [
          {
            type: 'LINK',
            mutability: 'MUTABLE',
            data: { path: '/home' },
          },
        ],
      },
      '/blocks/0/entityRanges/0/key - Expects a value among "0", got: 1',
    ],
  ])('throws an Error on invalid value', (input, error) => {
    expect(() => GraphQLDraftJS.parseValue(input)).toThrow(error);
  });

  it.each<[input: RawDraftContentState]>([
    [
      // entityMap with an object
      {
        blocks: [
          {
            key: 'abc',
            type: 'unstyled',
            text: 'abcde fghijk',
            depth: 0,
            inlineStyleRanges: [],
            entityRanges: [
              { key: 0, offset: 0, length: 5 },
              { key: 1, offset: 6, length: 5 },
            ],
          },
        ],
        entityMap: {
          0: {
            type: 'LINK',
            mutability: 'MUTABLE',
            data: { path: '/home' },
          },
          1: {
            type: 'LINK',
            mutability: 'MUTABLE',
            data: { path: '/news' },
          },
        },
      },
    ],
    [
      // entityMap with an array
      {
        blocks: [
          {
            key: 'abc',
            type: 'unstyled',
            text: 'abcde',
            depth: 0,
            inlineStyleRanges: [],
            entityRanges: [{ key: 0, offset: 0, length: 5 }],
          },
        ],
        entityMap: [
          {
            type: 'LINK',
            mutability: 'MUTABLE',
            data: { path: '/home' },
          },
        ],
      },
    ],
    [
      JSON.parse(
        '{"entityMap":[{"type":"LINK","mutability":"MUTABLE","data":{"url":"http:\\/\\/www.voici.fr\\/tele\\/thierry-moreau-annonce-son-depart-surprise-de-touche-pas-a-mon-poste-631558"}},{"type":"LINK","mutability":"MUTABLE","data":{"url":"http:\\/\\/www.voici.fr\\/bios-people\\/thierry-moreau"}},{"type":"LINK","mutability":"MUTABLE","data":{"url":"http:\\/\\/www.voici.fr\\/tele\\/enora-malagre-quitte-tpmp-cyril-hanouna-et-ses-chroniqueurs-reagissent-633609"}},{"type":"LINK","mutability":"MUTABLE","data":{"url":"http:\\/\\/www.voici.fr\\/bios-people\\/cyril-hanouna"}},{"type":"LINK","mutability":"MUTABLE","data":{"url":"http:\\/\\/www.voici.fr\\/tele\\/apres-ses-adieux-surprise-a-touche-pas-a-mon-poste-enora-malagre-reprend-la-parole-633765"}}],"blocks":[{"key":"75u0a","text":"Coup de th\\u00e9\\u00e2tre le 30 mai dernier dans TPMP. Quelques semaines apr\\u00e8s le d\\u00e9part de Thierry Moreau, Enora Malagr\\u00e9 annon\\u00e7ait sur Twitter qu\\u2019elle quittait le talk-show de C8. \\u00ab Comme vous l\'avez constat\\u00e9, \\u00e7a fait plusieurs mois que je me pose des questions sur mon avenir \\u00e0 la t\\u00e9l\\u00e9vision et sur ma place dans Touche pas \\u00e0 mon poste, a-t-elle expliqu\\u00e9. Et je crois justement que je n\'y trouve plus ma place\\u2026 Alors je vous annonce ce soir que je quitte officiellement Touche pas \\u00e0 mon poste. \\u00bb","type":"unstyled","depth":0,"inlineStyleRanges":[{"offset":173,"length":156,"style":"ITALIC"},{"offset":346,"length":139,"style":"ITALIC"}],"entityRanges":[{"offset":69,"length":9,"key":0},{"offset":82,"length":14,"key":1},{"offset":134,"length":29,"key":2}],"data":[]},{"key":"89j6","text":"Apr\\u00e8s 7 ans pass\\u00e9s aux c\\u00f4t\\u00e9s de Cyril Hanouna, Enora Malagr\\u00e9 a donc abandonn\\u00e9 le navire en pleine pol\\u00e9mique suite au canular homophobe de l\\u2019animateur de TPMP et aux ennuis de celui-ci avec le Conseil Sup\\u00e9rieur de l\\u2019Audiovisuel. Le lendemain de l\\u2019annonce de son d\\u00e9part, l\\u2019ex-chroniqueuse avait cependant repris la parole pour remercier ses fans pour leur soutien. \\u00ab Merci pour tous vos messages, vous \\u00eates merveilleux. J\\u2019en ai pleur\\u00e9 \\u00bb, a-t-elle confi\\u00e9 sur Twitter en promettant de s\\u2019exprimer bient\\u00f4t \\u00ab car beaucoup de b\\u00eatises sont dites \\u00bb.","type":"unstyled","depth":0,"inlineStyleRanges":[{"offset":365,"length":67,"style":"ITALIC"},{"offset":502,"length":34,"style":"ITALIC"}],"entityRanges":[{"offset":32,"length":13,"key":3},{"offset":303,"length":40,"key":4}],"data":[]},{"key":"cfpbh","text":"En attendant d\\u2019avoir les r\\u00e9v\\u00e9lations d\\u2019Enora Malagr\\u00e9 concernant son d\\u00e9part de Touche pas \\u00e0 mon poste, cette derni\\u00e8re profite de son temps libre pour pr\\u00e9parer sa rentr\\u00e9e et surtout lire tous les messages de ses t\\u00e9l\\u00e9spectateurs d\\u00e9\\u00e7us de ne plus la voir \\u00e0 l\\u2019antenne. \\u00ab Merci pour vos lettres, je lis tout. Je suis folle d\\u2019amour pour vous \\u00bb, a \\u00e9crit la jeune femme sur le r\\u00e9seau social, en postant des lettres manuscrites de ses fans. Des mots doux qui permettent \\u00e0 Enora de trouver un peu de r\\u00e9confort.","type":"unstyled","depth":0,"inlineStyleRanges":[{"offset":266,"length":68,"style":"ITALIC"}],"entityRanges":[],"data":[]},{"key":"9efvb","text":"","type":"atomic","depth":0,"inlineStyleRanges":[],"entityRanges":[],"data":{"type":"media","key":null,"caption":null,"href":null,"iframely":{"meta":{"title":"Enora Malagr\\u00e9 on Twitter","author":"Enora Malagr\\u00e9","author_url":"https:\\/\\/twitter.com\\/EnoraMofficiel","site":"Twitter","description":"M\\u00e8rci pour vos lettres je lis tout je suis folle  D amour pour vous pic.twitter.com\\/bOVRtSBJH9&mdash; Enora Malagr\\u00e9 (@EnoraMofficiel) June 14, 2017\\n","canonical":"https:\\/\\/twitter.com\\/EnoraMofficiel\\/status\\/874960520281018369"},"links":{"app":[{"html":"<blockquote class=\\"twitter-tweet\\" align=\\"center\\"><p lang=\\"fr\\" dir=\\"ltr\\">M\\u00e8rci pour vos lettres je lis tout je suis folle  D amour pour vous <a href=\\"https:\\/\\/t.co\\/bOVRtSBJH9\\">pic.twitter.com\\/bOVRtSBJH9<\\/a><\\/p>&mdash; Enora Malagr\\u00e9 (@EnoraMofficiel) <a href=\\"https:\\/\\/twitter.com\\/EnoraMofficiel\\/status\\/874960520281018369\\">June 14, 2017<\\/a><\\/blockquote>\\n<script async src=\\"\\/\\/platform.twitter.com\\/widgets.js\\" charset=\\"utf-8\\"><\\/script>","type":"text\\/html","rel":["app","inline","ssl","html5"],"media":{"max-width":550}}],"thumbnail":[{"href":"https:\\/\\/pbs.twimg.com\\/media\\/DCR78QPWAAAQSMm.jpg:large","type":"image","rel":["thumbnail","ssl"]}],"icon":[{"href":"https:\\/\\/abs.twimg.com\\/icons\\/apple-touch-icon-192x192.png","rel":["apple-touch-icon","icon","ssl"],"type":"image\\/png","media":{"width":192,"height":192}},{"href":"https:\\/\\/abs.twimg.com\\/a\\/1498793527\\/img\\/t1\\/favicon.svg","rel":["mask-icon","icon","ssl"],"type":"image\\/svg"},{"href":"https:\\/\\/abs.twimg.com\\/favicons\\/favicon.ico","rel":["shortcut","icon","icon","ssl"],"type":"image\\/x-icon"}]},"rel":["app","inline","ssl","html5"],"html":"<blockquote class=\\"twitter-tweet\\" align=\\"center\\"><p lang=\\"fr\\" dir=\\"ltr\\">M\\u00e8rci pour vos lettres je lis tout je suis folle  D amour pour vous <a href=\\"https:\\/\\/t.co\\/bOVRtSBJH9\\">pic.twitter.com\\/bOVRtSBJH9<\\/a><\\/p>&mdash; Enora Malagr\\u00e9 (@EnoraMofficiel) <a href=\\"https:\\/\\/twitter.com\\/EnoraMofficiel\\/status\\/874960520281018369\\">June 14, 2017<\\/a><\\/blockquote>\\n<script async src=\\"\\/\\/platform.twitter.com\\/widgets.js\\" charset=\\"utf-8\\"><\\/script>"}}}]}',
      ),
    ],
    [
      JSON.parse(
        '{"blocks":[{"key":"7v0fk","text":"En 2022, Diane Leyre est apparue dans une tenue merveilleuse pour la montée des marches de Broker (Les bonnes étoiles), réalisé par Hirokazu Kore-eda. Miss France 2 022 était vêtue d\'un jupon, confectionné en organza dont le dos était agrémenté d\'un corset à lacets. Une tenue qui lui donnait une allure féerique. Pour son premier tapis rouge au Festival de Cannes, la Parisienne avait choisi avec fierté une robe griffée Milla Dress, une créatrice ukrainienne. Le vêtement rose pâle et vaporeux dévoilait l\'épaule droite de la mannequin. Pour compléter ce fabuleux look, Miss Île-de-France 2021 portait une parure de bijoux signée Nour by Jahan, composée d\'une bague papillon et d\'un bracelet assorti.","type":"unstyled","depth":0,"inlineStyleRanges":[],"entityRanges":[{"offset":132,"length":17,"key":0}],"data":{}},{"key":"ubn7","text":"Une robe qui a sauvé la première apparition sur la Croisette de Diane Leyre. Miss France 2022 racontait alors sa journée dans un journal de bord publié sur son compte Instagram. La jeune femme ne savait toujours pas comment elle s\'habillerait trois heures avant le début du film présenté par la Palme d\'or 2018 . \\"Je n\'ai pas de robe, tout ce que j\'ai essayé jusqu\'à présent ne me va pas… Ce n’est pas du tout ce qu\'on avait prévu\\", confiait un brin inquiète la splendide brune vers 16 heures ce jour-là. Avant d\'ajouter avec humour : \\"Mon plus gros challenge, ça va être d\'être habillée avant la fin du film. La projection est à 19 heures et si j\'arrive à être prête avant 23 heures, ce serait un grand miracle\\". Défi relevé pour la plus belle femme de France 2022, qui avait attaché ses cheveux dans un joli chignon bas pour parfaire cette divine apparition sur la Croisette.","type":"unstyled","depth":0,"inlineStyleRanges":[],"entityRanges":[{"offset":64,"length":29,"key":1}],"data":{}},{"key":"b6j0e","text":">> PHOTOS - Cannes 2022 : Marina Foïs, Bella Hadid et Chiara Mastroianni rivalisent d\'élégance sur le tapis rouge","type":"unstyled","depth":0,"inlineStyleRanges":[],"entityRanges":[{"offset":26,"length":11,"key":2},{"offset":39,"length":11,"key":3},{"offset":54,"length":18,"key":4}],"data":{}},{"key":"2dhvv","text":"Bella Hadid enivrante sur la Croisette","type":"unstyled","depth":0,"inlineStyleRanges":[],"entityRanges":[],"data":{}},{"key":"biuvq","text":"Diane Leyre n\'était pas la seule à sortir le grand jeu en ce dixième jour du Festival de Cannes 2022. Bella Hadid avait captivé les photographes dans une longue robe blanche épousant sa silhouette de rêve. La sœur de Gigi Hadid portait une tenue griffée Tom Ford pour Gucci. La top model s\'était déjà fait remarquer, deux jours plutôt, pour la présentation du film L\'innocent ce mardi 24 mai. Elle s\'était alors drapée dans une robe vintage Versace, issue des archives de la collection Printemps-Été 1987.","type":"unstyled","depth":0,"inlineStyleRanges":[],"entityRanges":[{"offset":217,"length":10,"key":5},{"offset":254,"length":8,"key":6}],"data":{}}],"entityMap":{"0":{"type":"PERSON_LINK","mutability":"MUTABLE","data":{"id":"82e54e4d-a701-4023-85bf-7bb33b29f780","fullName":"Hirokazu Kore-Eda","url":"https://www.gala.fr/stars_et_gotha/hirokazu_kore-eda"}},"1":{"type":"PERSON_LINK","mutability":"MUTABLE","data":{"id":"4b8cba08-1fc3-419c-8db6-8d9106ed442c","fullName":"Diane Leyre - Miss France 2022","url":"https://www.gala.fr/stars_et_gotha/diane_leyre_-_miss_france_2022"}},"2":{"type":"PERSON_LINK","mutability":"MUTABLE","data":{"id":"990f0f9c-45d6-4c4d-90c6-8b66caddfe27","fullName":"Marina Foïs","url":"https://www.gala.fr/stars_et_gotha/marina_fois"}},"3":{"type":"PERSON_LINK","mutability":"MUTABLE","data":{"id":"25eb1d56-3874-4fc4-a0e7-85e7b23d1643","fullName":"Bella Hadid","url":"https://www.gala.fr/stars_et_gotha/bella_hadid"}},"4":{"type":"PERSON_LINK","mutability":"MUTABLE","data":{"id":"619fa488-8d7d-4499-9c66-befb40b4a844","fullName":"Chiara Mastroianni","url":"https://www.gala.fr/stars_et_gotha/chiara_mastroianni"}},"5":{"type":"PERSON_LINK","mutability":"MUTABLE","data":{"id":"b9b96c58-ddeb-4e8e-931d-967b991c54a8","fullName":"Gigi Hadid","url":"https://www.gala.fr/stars_et_gotha/gigi_hadid"}},"6":{"type":"PERSON_LINK","mutability":"MUTABLE","data":{"id":"b4ee89a6-02a1-4c7e-b096-240378b000f0","fullName":"Tom Ford","url":"https://www.gala.fr/stars_et_gotha/tom_ford"}}}}',
      ),
    ],
  ])('parses & serializes', (input) => {
    expect(GraphQLDraftJS.parseValue(input)).toBeDefined();
    expect(GraphQLDraftJS.serialize(input)).toBeDefined();
  });
});
