import fetch from 'node-fetch';

const testAPI = async () => {
  console.log('Testing image generation API...');
  
  try {
    // First, try a GET request to see if the API is accessible
    console.log('Testing API accessibility with GET request...');
    const getResponse = await fetch('https://image-generation-service-856401495068.us-central1.run.app/');
    console.log(`GET response status: ${getResponse.status} ${getResponse.statusText}`);
    
    // Try using 'id' instead of 'appraiser_id'
    console.log('\nTesting /api/generate endpoint with id field...');
    const idResponse = await fetch('https://image-generation-service-856401495068.us-central1.run.app/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Test prompt for a professional headshot',
        style: 'realistic',
        filename: 'test_image_' + Date.now() + '.jpg',
        id: 'test-appraiser-id'
      }),
    });
    
    console.log(`POST response status: ${idResponse.status} ${idResponse.statusText}`);
    
    if (idResponse.ok) {
      const data = await idResponse.json();
      console.log('Response data:', data);
    } else {
      const errorText = await idResponse.text();
      console.log('Error response:', errorText);
    }
    
    // Try sending appraiser object with id
    console.log('\nTesting with appraiser object structure...');
    const appraisersResponse = await fetch('https://image-generation-service-856401495068.us-central1.run.app/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Professional headshot of an art appraiser. Business professional attire, neutral background, high quality portrait.',
        appraiser: {
          id: 'test-appraiser-id',
          name: 'Test Appraiser'
        },
        location: 'test-location'
      }),
    });
    
    console.log(`Appraiser object response status: ${appraisersResponse.status} ${appraisersResponse.statusText}`);
    
    if (appraisersResponse.ok) {
      const data = await appraisersResponse.json();
      console.log('Response data:', data);
    } else {
      const errorText = await appraisersResponse.text();
      console.log('Error response:', errorText);
    }
    
  } catch (error) {
    console.error('API test failed with error:', error);
  }
};

testAPI().catch(console.error); 