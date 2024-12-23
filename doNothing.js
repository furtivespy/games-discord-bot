console.log('Starting to do nothing for 30 minutes...');

// Set a timeout for 30 minutes (1800000 milliseconds)
setTimeout(() => {
  console.log('Finished doing nothing. Exiting...');
  process.exit(0);
}, 30 * 60 * 1000);

// Keep the process alive
setInterval(() => {}, 1000);
