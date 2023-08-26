import util from 'util';
import { DocsTopLevelClass, DocsDataClassMap } from '@/types';
import { parseItems, parseBuildables, parseRecipes, parseSchematics } from '@/parsers';
import { categorizeDataClasses, validateClassList } from '@/class-categorizer';

const nativeClassRegex = /FactoryGame\.(.+)'$/;

function parseDocs(input: Buffer | string) {
  if (Buffer.isBuffer(input)) {
    try {
      // Try utf-16
      const decoder = new util.TextDecoder('utf-16le');
      return parseDocsString(decoder.decode(input));
    } catch {
      // if not try utf-8
      const decoder = new util.TextDecoder('utf-8');
      return parseDocsString(decoder.decode(input));
    }
  } else {
    return parseDocsString(input);
  }
}

function parseDocsString(input: string) {
  const docs = (JSON.parse(input) as DocsTopLevelClass[]);

  if (!Array.isArray(docs)) {
    throw new Error('Invalid Docs.json file -- not an array');
  }

  const dataClassMap: DocsDataClassMap = {};
  for (const entry of docs) {
    if (!Object.prototype.hasOwnProperty.call(entry, 'NativeClass') || !Object.prototype.hasOwnProperty.call(entry, 'Classes')) {
      throw new Error('Invalid Docs.json file -- missing required keys');
    }
    const match = nativeClassRegex.exec(entry.NativeClass);
    // console.log(match)
    if (!match || !match[1]) {
      throw new Error(`Could not parse top-level class ${entry.NativeClass}`);
    }
    const nativeClassName = match[1];
    dataClassMap[nativeClassName] = entry.Classes;
  }

  const topLevelClassList = Object.keys(dataClassMap).sort();
  validateClassList(topLevelClassList);
  const categorizedDataClasses = categorizeDataClasses(dataClassMap);

  function sort(data: any, keyName: any) {
    // Convert the object to an array
    const dataArray: any[] = Object.values(data);
    const dataKeys = Object.keys(data);
    const dataName = dataArray.map(obj => obj[keyName]);

    if (dataKeys.length !== dataName.length) {console.warn("Sortng: Arrays don't have the same length"); return;}
    const mergedArray: { [keyName: string]: any }[] = dataKeys.map((keyName, index) => ({
        [keyName]: dataName[index]
    }));

    function findKeyByValue(arr: any[], valueToFind: string): string | any {
      for (const obj of arr) {
        const key = Object.keys(obj)[0]; // Get the key (e.g., 'Desc_CartridgeChaos_C')
        const value = obj[key]; // Get the value (e.g., 'Turbo Rifle Ammo')
    
        if (value === valueToFind) {
          return key;
        }
      }
      return null; // Value not found
    }

    // Sort the array based on the 'keyName' property
    dataArray.sort((a: any, b: any) => a[keyName].localeCompare(b[keyName]));

    // Convert the sorted array back to an object (if needed)
    let sortedObject = dataArray.reduce((acc: any, obj: any, index) => {
      acc[findKeyByValue(mergedArray, obj[keyName])] = obj;
      return acc;
    }, {});
    if(sortedObject === ''){
      sortedObject = data
      throw new Error(`Could not sort array`);
    }
    return sortedObject
  }

  const { items, resources } = parseItems(categorizedDataClasses);
  if(items && resources)console.log('Items and resources parsed')

  const itemsSorted = sort(items, 'name')
  console.log('Sorted: items')
  const resourcesSorted = sort(resources, 'itemClass')
  console.log('Sorted: resources')
  
  const buildables = parseBuildables(categorizedDataClasses, { items, resources });
  if(buildables)console.log('Buildables parsed')

  const buildablesSorted = sort(buildables, 'name')
  console.log('Sorted: buildables')

  const { productionRecipes, buildableRecipes, customizerRecipes } = parseRecipes(categorizedDataClasses, { items, buildables });
  if(productionRecipes && buildableRecipes && customizerRecipes)console.log('Production, buildable and customizer recipes parsed')

  const productionRecipesSorted = sort(productionRecipes, 'name')
  console.log('Sorted: roductionRecipes')
  const buildableRecipesSorted = sort(buildableRecipes, 'slug')
  console.log('Sorted: buildableRecipes')
  const customizerRecipesSorted = sort(customizerRecipes, 'slug')
  console.log('Sorted: customizerRecipes')

  const schematics = parseSchematics(categorizedDataClasses, { items, resources, productionRecipes, buildableRecipes, customizerRecipes });
  if(schematics)console.log('Schematics parsed')

  const schematicsSorted = sort(schematics, 'name')
  console.log('Sorted: schematics')

  const data = {
    items,
    resources,
    buildables,
    productionRecipes,
    buildableRecipes,
    customizerRecipes,
    schematics,
  };
  
  const dataSorted = {
    itemsSorted,
    resourcesSorted,
    buildablesSorted,
    productionRecipesSorted,
    buildableRecipesSorted,
    customizerRecipesSorted,
    schematicsSorted,
  };
  // console.log(data)
  validateSlugs(data);

  return {
    meta: {
      originalDocs: docs,
      topLevelClassList,
      dataClassesByTopLevelClass: dataClassMap,
      dataClassesByCategory: categorizedDataClasses,
    },
    ...data, ...dataSorted,
  };
}

const slugRegex = /^[a-z0-9-]+$/;
function validateSlugs(data: any) {
  const slugs: string[] = [];
  Object.entries<any>(data).forEach(([category, entries]) => {
    Object.entries<any>(entries).forEach(([className, classData]) => {
      if (!slugRegex.exec(classData.slug)) {
        // eslint-disable-next-line no-console
        console.warn(`WARNING: Invalid slug format: [${classData.slug}] of [${className}] from [${category}]`);
      }
      if (classData.slug) {
        if (slugs.includes(classData.slug)) {
          // eslint-disable-next-line no-console
          console.warn(`WARNING: Duplicate global slug: [${classData.slug}] of [${className}] from [${category}]`);
        } else {
          slugs.push(classData.slug);
        }
      }
    });
  });
}

export = parseDocs;
