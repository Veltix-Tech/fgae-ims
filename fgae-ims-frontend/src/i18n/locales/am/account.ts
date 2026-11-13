import type { account as en } from '../en/account'
export const account: Record<keyof typeof en, string> = {
  acctDenied: 'ለዚህ ክፍለ ጊዜ የመለያ ቅንብሮች አይገኙም', acctDeniedNote: 'ወደ መለያዎ ይመለሱ. የይለፍ ቃል ማዘጋጀት ካስፈለገ መጀመሪያ ያጠናቅቁ.',
  acctWrongPassword: 'የአሁኑ የይለፍ ቃልዎ ትክክል አይደለም. አረጋግጠው እንደገና ይሞክሩ.',
  acctTitle: 'የመለያ ቅንብሮች · FGAE IMS', acctSkip: 'ወደ መለያ ቅንብሮች ዝለል', acctHeading: 'የመለያ ቅንብሮች', acctIntro: 'የግል ዝርዝሮችዎን፣ ፎቶዎን፣ ቋንቋዎን እና የይለፍ ቃልዎን ያስተዳድሩ.', acctLink: 'የመለያ ቅንብሮች', acctProfile: 'የግል ዝርዝሮች', acctPhoto: 'የመለያ ፎቶ',
  acctEmailNote: 'የመግቢያ ኢሜይልዎ በFGAE አስተዳዳሪዎ ይተዳደራል. መቀየር ካስፈለገ ያነጋግሯቸው.', acctAllowed: 'ለመለያዎ የተፈቀዱ መስኮችን ብቻ እዚህ ማስተካከል ይችላሉ.', acctLocale: 'የሚመርጡት ቋንቋ', acctLocaleHint: 'ምርጫዎን ከመለያዎ ጋር ያስቀምጡ. ከላይ ያለውን ቋንቋ መቀየር ያስገቡትን መረጃ አያጠፋም.',
  acctSave: 'ለውጦችን አስቀምጥ', acctSaving: 'ለውጦች እየተቀመጡ ነው…', acctSaved: 'የመለያ ቅንብሮችዎ ተቀምጠዋል.', acctDiscard: 'ለውጦችን ተው', acctDiscardTitle: 'ያልተቀመጡ ለውጦችን ይተዉ?', acctDiscardBody: 'ይህ የተቀመጡትን ዝርዝሮች፣ ፎቶ እና የቋንቋ ምርጫ ይመልሳል፤ ያስገቧቸውን የይለፍ ቃሎች ያጸዳል.',
  acctLeave: 'ከመለያ ቅንብሮች ይውጡ?', acctLeaveBody: 'ያልተቀመጡ የግል መረጃ ለውጦችና የይለፍ ቃል ግቤቶች ይጠፋሉ.', acctKeep: 'ማስተካከል ቀጥል', acctLeaveAction: 'ለውጦችን ትተህ ውጣ',
  acctConflict: 'የመለያ ቅንብሮችዎ በሌላ ትር ተቀይረዋል. ያስገቡት መረጃ አለ. ከማስቀመጥዎ በፊት የቅርብ ጊዜውን ይጫኑ.', acctReload: 'የተቀመጡ ቅንብሮችን እንደገና ጫን', acctReloadTitle: 'የቅርብ ጊዜውን የመለያ ቅንብሮች ይጫኑ?', acctReloadBody: 'ይህ የአሁኑን ግቤቶች በተቀመጡ ዝርዝሮች ይተካል፤ የይለፍ ቃል ግቤቶችንም ያጸዳል.',
  acctUnavailable: 'የመለያ ቅንብሮች ለጊዜው አይገኙም. እንደገና ይሞክሩ.', acctLoading: 'መለያዎ እየተጫነ ነው…', acctSecurity: 'የይለፍ ቃል ቀይር', acctSecurityIntro: 'አዲስ የይለፍ ቃል ለመምረጥ የአሁኑን ያስገቡ. ከቀየሩ በኋላ በሁሉም መሣሪያዎችዎ እንደገና ይግቡ.', acctCurrent: 'የአሁኑ የይለፍ ቃል', acctShowCurrent: 'የአሁኑን የይለፍ ቃል አሳይ', acctHideCurrent: 'የአሁኑን የይለፍ ቃል ደብቅ', acctCurrentRequired: 'የአሁኑን የይለፍ ቃልዎን ያስገቡ.',
  acctPasswordSave: 'የይለፍ ቃል ቀይር', acctPasswordSaving: 'የይለፍ ቃል እየተቀየረ ነው…', acctPasswordDone: 'የይለፍ ቃልዎ ተቀይሯል', acctPasswordDoneNote: 'ቀደምት የመግቢያ ክፍለ ጊዜዎች አብቅተዋል. በአዲሱ የይለፍ ቃልዎ እንደገና ይግቡ.',
  acctProfileFirst: 'የይለፍ ቃልዎን ከመቀየርዎ በፊት የግል መረጃ ለውጦችዎን ያስቀምጡ ወይም ይተዉ.', acctPhotoHint: 'እስከ 2 MB የሆነ JPEG ወይም PNG ይምረጡ. የፎቶ ለውጦች ሲያስቀምጡ ተግባራዊ ይሆናሉ.', acctRestricted: 'የይለፍ ቃል ማዘጋጀት ያስፈልጋል', acctRestrictedNote: 'የመለያ ቅንብሮችን ከማስተዳደርዎ በፊት ቋሚ የይለፍ ቃልዎን ያዘጋጁ.', acctValidation: 'ስምዎን፣ ስልክ ቁጥርዎንና ፎቶዎን አረጋግጠው እንደገና ይሞክሩ.',
  acctSignIn: 'መለያዎን ለማስተዳደር ይግቡ', acctSignInNote: 'የመግቢያ ክፍለ ጊዜዎ የለም ወይም አብቅቷል. ለመቀጠል እንደገና ይግቡ.',
}
