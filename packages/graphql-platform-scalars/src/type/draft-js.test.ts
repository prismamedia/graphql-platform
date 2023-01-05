import { GraphQLDraftJS, RawDraftContentState } from './draft-js.js';

describe('DraftJS', () => {
  it.each<[input: any, error: string]>([
    ['', 'Expects a plain object, got: '],
    [' ', 'Expects a plain object, got: '],
    [' \n \t ', 'Expects a plain object, got: '],
    [
      {
        blocks: [
          {
            key: 'abc',
            type: 'unstyled',
            text: 'abcde',
            depth: 0,
            inlineStyleRanges: [],
            entityRanges: [{ key: 'myMissingKey', offset: 0, length: 5 }],
          },
        ],
        entityMap: {
          myKey: {
            type: 'LINK',
            mutability: 'MUTABLE',
            data: { path: '/home' },
          },
        },
      },
      '/blocks/0/entityRanges/0/key - Expects a value among "myKey", got: \'myMissingKey\'',
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
    expect(() => GraphQLDraftJS.parseValue(input)).toThrowError(error);
  });

  it.each<[input: RawDraftContentState]>([
    [
      // entityMap with an object
      {
        blocks: [
          {
            key: 'abc',
            type: 'unstyled',
            text: 'abcde',
            depth: 0,
            inlineStyleRanges: [],
            entityRanges: [{ key: 'myKey', offset: 0, length: 5 }],
          },
        ],
        entityMap: {
          myKey: {
            type: 'LINK',
            mutability: 'MUTABLE',
            data: { path: '/home' },
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
  ])('parses & serializes', (input) => {
    expect(GraphQLDraftJS.parseValue(input)).toBeDefined();
    expect(GraphQLDraftJS.serialize(input)).toBeDefined();
  });
});
