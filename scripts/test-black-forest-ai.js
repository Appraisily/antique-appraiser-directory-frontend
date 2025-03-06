import fetch from 'node-fetch';

// Constants
const IMAGE_GENERATION_API = 'https://image-generation-service-856401495068.us-central1.run.app/api/generate';

/**
 * Test Black Forest AI service status
 */
async function testBlackForestAI() {
  console.log('==== Testing Black Forest AI Service Status ====');
  console.log(`Using API endpoint: ${IMAGE_GENERATION_API}`);
  
  try {
    // Make a simple test request
    const testRequest = {
      prompt: 'Test prompt for diagnostics only',
      filename: 'test-image.jpg',
      style: 'professional',
      debug: true,
      appraiser: {
        id: 'test-appraiser',
        name: 'Test Appraiser'
      }
    };
    
    console.log('Sending test request to image generation API...');
    console.log('Request payload:', JSON.stringify(testRequest, null, 2));
    
    const response = await fetch(IMAGE_GENERATION_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testRequest),
    });
    
    const responseText = await response.text();
    console.log(`Response status: ${response.status} ${response.statusText}`);
    
    try {
      const data = JSON.parse(responseText);
      console.log('Response details:');
      console.log(JSON.stringify(data, null, 2));
      
      // Check for specific error codes
      if (response.status === 402 || (data.rootCause && data.rootCause.includes('402'))) {
        console.error('\n======= BLACK FOREST AI PAYMENT ISSUE DETECTED =======');
        console.error('The Black Forest AI service has exhausted its credits or requires payment.');
        console.error('Please check the account status and billing information at blackforest.ai');
        console.error('====================================================\n');
      }
    } catch (e) {
      console.log('Raw response text:');
      console.log(responseText);
    }
    
  } catch (error) {
    console.error('Error testing image generation service:', error.message);
  }
}

// Run the test
testBlackForestAI().then(() => {
  console.log('Test completed');
}); 