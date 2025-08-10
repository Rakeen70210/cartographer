console.log('Testing toFixed rounding:');
console.log('999.999.toFixed(3):', (999.999).toFixed(3));
console.log('0.9999.toFixed(3):', (0.9999).toFixed(3));
console.log('99.999.toFixed(2):', (99.999).toFixed(2));
console.log('9.99.toFixed(1):', (9.99).toFixed(1));

// Test with different values
console.log('\nTesting edge cases:');
console.log('999.9999.toFixed(3):', (999.9999).toFixed(3));
console.log('999.9995.toFixed(3):', (999.9995).toFixed(3));
console.log('999.9994.toFixed(3):', (999.9994).toFixed(3));