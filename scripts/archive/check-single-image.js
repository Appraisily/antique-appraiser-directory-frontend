import fetch from 'node-fetch';

async function checkImage(url) {
  try {
    console.log('Checking image URL:', url);
    const response = await fetch(url, { method: 'HEAD' });
    console.log('Response status:', response.status);
    return response.ok;
  } catch (error) {
    console.error('Error checking image:', error.message);
    return false;
  }
}

const testImageUrl = 'https://ik.imagekit.io/appraisily/appraiser-images/appraiser_aspen-mary-peck-art-advisory_1740830037057_Vw9h4583g.jpg';

checkImage(testImageUrl)
  .then(exists => {
    if (!exists) {
      console.log('Image does not exist, need to generate a new one');
    } else {
      console.log('Image exists, no need to generate a new one');
    }
  })
  .catch(error => {
    console.error('Error in the process:', error);
  });
