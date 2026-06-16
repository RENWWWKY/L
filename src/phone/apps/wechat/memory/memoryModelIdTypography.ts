import type { CSSProperties } from 'react'

import { listenPlainNumStyle } from '../../../../components/discoverListen/listenTogetherTypography'
import {
  isPhoneDigitTextToken,
  isPhoneLatinTextToken,
  phoneLatinTextStyle,
  splitPhoneMixedLatinNumText,
} from '../../../phoneMixedLatinNumText'

export const memoryModelLatinStyle: CSSProperties = phoneLatinTextStyle

export const memoryModelDigitStyle: CSSProperties = {
  ...listenPlainNumStyle,
}

export {
  isPhoneDigitTextToken as isMemoryModelDigitToken,
  isPhoneLatinTextToken as isMemoryModelLatinToken,
  splitPhoneMixedLatinNumText as splitMemoryModelIdText,
}
