interface Options {
  charset: string;
  blacklist: string[] | Set<string>;
}

const alphabet: string = 'abcdefghijklmnopqrstuvwxyz';

export function getPredictableSequence(number: number, charset: Options['charset'] = alphabet): string {
  const charsetLength = charset.length;
  if (charsetLength === 0) {
    throw new Error(`The charset has to contain at least 1 character.`);
  }

  let output = '';

  while (number >= 0) {
    output = charset[number % charsetLength] + output;
    number = Math.floor(number / charsetLength);
    number--;
  }

  return output;
}

export function getPredictableId(ids: string[] | Set<string> = new Set(), options?: Partial<Options>): string {
  const charset = (options && options.charset) || alphabet;
  const blacklist = new Set([...ids, ...((options && options.blacklist) || [])]);

  let id: string = '';

  let i = 0;
  do {
    id = getPredictableSequence(i, charset);

    i++;
  } while (blacklist.has(id));

  return id;
}
