// Random + recursive demo code

function randomInt(min, max) {
  // Inclusive random integer between min and max.
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildRandomArray(length, min = 0, max = 9, acc = []) {
  if (acc.length >= length) return acc;
  const next = randomInt(min, max);
  return buildRandomArray(length, min, max, [...acc, next]);
}

function factorial(n) {
  if (n < 0) throw new Error("n must be >= 0");
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

function countdown(n) {
  if (n < 0) return;
  console.log(n);
  return countdown(n - 1);
}

module.exports = { randomInt, buildRandomArray, factorial, countdown };

if (require.main === module) {
  console.log("Random array:", buildRandomArray(10, 1, 100));
  console.log("Factorial(5):", factorial(5));
  console.log("Countdown:");
  countdown(5);
}
