const oss = require('ali-oss');
const path = require('path');
const fs = require('fs');
const request = require('request');
const scaffolds = require('./scaffolds');

const bucket = 'iceworks';
const accessKeyId = process.env.ACCESS_KEY_ID;
const accessKeySecret = process.env.ACCESS_KEY_SECRET;
const branch = process.env.TRAVIS_BRANCH;
const assetsPath = branch === 'production' ? 'assets' : 'pre-assets';

if (['master', 'production'].indexOf(branch) === -1) {
  console.log('当前分支非 master/production, 不执行物料源同步脚本');
  console.log(`TRAVIS_BRANCH=${branch}`);
  process.exit(0);
}

const ossClient = oss({
  bucket,
  endpoint: 'oss-cn-hangzhou.aliyuncs.com',
  accessKeyId,
  accessKeySecret,
  time: '120s',
});

const materialPath = path.resolve(__dirname, '../build/materials.json');
const toPath = path.join(assetsPath, 'react-materials.json');

console.log('start upload oss', materialPath, toPath);

sortScaffoldMaterials()
  .then(mergeBizchartsBlocks)
  .then(() => {
    return ossClient.put(toPath, materialPath);
  })
  .then((result) => {
    console.log('upload success', result);
  });

/**
 * 按照下载量进行排序推荐
 */
function sortScaffoldMaterials() {
  return new Promise((resolve, reject) => {
    const materialsData = JSON.parse(fs.readFileSync(materialPath, 'utf-8'));

    const sortMaterialsData = [];
    scaffolds.forEach((scaffold) => {
      materialsData.scaffolds.forEach((currentItem) => {
        if (currentItem.name === scaffold) {
          sortMaterialsData.push(currentItem);
        }
      });
    });

    materialsData.scaffolds = sortMaterialsData;

    return fs.writeFile(
      materialPath,
      JSON.stringify(materialsData, null, 2),
      'utf-8',
      (err) => {
        if (err) reject(err);
        resolve();
      }
    );
  });
}


/**
 * 合并 bizchart 的区块物料
 */
function mergeBizchartsBlocks() {
  return new Promise((resolve, reject) => {
    const materialsData = JSON.parse(fs.readFileSync(materialPath, 'utf-8'));

    request(
      {
        url:
          'http://g.alicdn.com/bizcharts-material/scripts/material-assets.json',
        json: true,
      },
      (error, response, body) => {
        if (body) {
          const bizchartBlocks = (body.blocks || []).map((item) => {
            item.categories = ['图表'];
            return item;
          });
          materialsData.blocks = materialsData.blocks.concat(bizchartBlocks);
          return fs.writeFile(
            materialPath,
            JSON.stringify(materialsData, null, 2),
            'utf-8',
            (err) => {
              if (err) reject(err);
              resolve();
            }
          );
        }

        console.log('获取 bizcharts 物料源失败', error);
        return resolve();
      }
    );
  });
}
