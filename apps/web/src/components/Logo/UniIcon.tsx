import styled from 'styled-components'

import HolidayUniIcon from './HolidayUniIcon'

// ESLint reports `fill` is missing, whereas it exists on an SVGProps type
export type SVGProps = React.SVGProps<SVGSVGElement> & {
  fill?: string
  height?: string | number
  width?: string | number
  gradientId?: string
}

export const UniIcon = (props: SVGProps) => (

  <HolidayUniIcon {...props} />

)

const Container = styled.div`
  position: relative;
`
