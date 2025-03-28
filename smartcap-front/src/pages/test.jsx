// AlarmMapView.jsx (Tailwind + Google Map + React)
import React from 'react';
import { GoogleMap, LoadScript } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '100vh'
};

const center = {
  lat: 37.5665,
  lng: 126.9780,
};

const AlarmMapView = () => {
  return (
    <LoadScript googleMapsApiKey="AIzaSyCot_dk88YZ0AjmkLy9Oufrffz-84kPEr0">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={25}
        mapTypeId="satellite"
      >
        {/* 붉은 깜빡이는 원 - Tailwind 적용 */}
        <div
          className="absolute left-1/2 top-1/2 w-8 h-8 bg-red-500 rounded-full opacity-60 animate-ping pointer-events-none z-10"
          style={{ transform: 'translate(-50%, -50%)' }}
        ></div>
      </GoogleMap>
    </LoadScript>
  );
};

export default AlarmMapView;
