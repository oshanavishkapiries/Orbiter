import 'dotenv/config';
import { getMemoryManager } from '../src/memory/manager.js';

async function main() {
  console.log('Initializing Memory Manager...');
  const manager = await getMemoryManager();

  console.log('Storing a vector memory...');
  await manager.rememberVectorContext(
    'test-mem-1',
    'google.com',
    'I successfully found the search bar and searched for "hotels". The search bar has name="q".',
    { success: true, steps: 3 }
  );

  await manager.rememberVectorContext(
    'test-mem-2',
    'booking.com',
    'I found the date picker but it required two clicks to select the range.',
    { success: true, issues: 'UI delay' }
  );

  console.log('Searching for relevant context for Google search...');
  const results = await manager.searchVectorContext('google.com', 'Where is the search input field?', 2);
  
  console.log('\nSearch Results:');
  for (const r of results) {
    console.log(`- Score: ${r.similarity.toFixed(4)}`);
    console.log(`  Summary: ${r.task_summary}`);
    console.log(`  Context: ${JSON.stringify(r.context_json)}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
