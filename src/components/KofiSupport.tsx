'use client';

import { Donate } from 'react-kofi-overlay';

export function KofiSupport() {
  return (
    <Donate
      username="oddmelody"
      styles={{
        panel: {
          right: '20px',
          left: 'auto'
        }
      }}
      classNames={{
        donateBtn: 'kofi-donate-button'
      }}
    >
      ❤️ Support
    </Donate>
  );
}
