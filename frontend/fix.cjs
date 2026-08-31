const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      results.push(filePath);
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'src'));

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  if (file.includes(path.join('src', 'api'))) {
     content = content.replace(/\.\.\/src\/types\//g, '../types/');
  } else {
     content = content.replace(/(['"])\.\.\/\.\.\/\.\.\/api/g, '$1__TMP_API__');
     content = content.replace(/(['"])\.\.\/\.\.\/api/g, '$1../api');
     content = content.replace(/__TMP_API__/g, '../../api');
  }
  
  if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
  }
});
console.log('Fixed imports!');
