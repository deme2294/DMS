import bcrypt from 'bcrypt';

async function test() {
  const hash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
  const isMatch = await bcrypt.compare('password', hash);
  console.log('Matches "password"?', isMatch);
  
  const isMatch2 = await bcrypt.compare('admin', hash);
  console.log('Matches "admin"?', isMatch2);
}

test();
