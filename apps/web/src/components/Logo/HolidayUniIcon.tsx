import { t } from '@lingui/macro'
import { ReactElement } from 'react'

import { ReactComponent as WinterUni } from '../../assets/svg/winter-uni.svg'
import { ReactComponent as WinterUniMobile } from '../../assets/svg/winter-uni-mobile.svg'

import { SVGProps } from './UniIcon'
const isMobile = window.innerWidth < 924 ? 0 : 1;

const MONTH_TO_HOLIDAY_UNI: { [date: string]: (props: SVGProps) => ReactElement } = {
 
  '0': (props) => <WinterUniMobile {...props} />,
  '1': (props) => <WinterUni {...props} />,
}

export default function HolidayUniIcon(props: SVGProps): ReactElement | null {
  // months in javascript are 0 indexed...
  const currentMonth = `${new Date().getMonth() + 1}`
  const HolidayUni = MONTH_TO_HOLIDAY_UNI[isMobile]
  return HolidayUni ? <HolidayUni {...props} /> : null
}
