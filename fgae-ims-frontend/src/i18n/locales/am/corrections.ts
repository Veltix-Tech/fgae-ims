import type { corrections as en } from '../en/corrections'
export const corrections: Record<keyof typeof en, string> = {
  corrTitle: 'ማመልከቻ ማስተካከያ · FGAE IMS', corrSkip: 'ወደ ማመልከቻ ማስተካከያ ዝለል', corrHeading: 'ማመልከቻዎን ያስተካክሉ', corrIntro: 'የተጠየቁትን ማስተካከያዎች ያድርጉ፤ ከዚያም መረጃውን አረጋግጠው ማመልከቻዎን ለግምገማ እንደገና ይላኩ.',
  corrLink: 'የተጠየቁትን ማስተካከያዎች አድርግ', corrBack: 'ወደ ማመልከቻዬ ተመለስ', corrFeedback: 'ትኩረትዎን የሚፈልጉ ነጥቦች', corrDetails: 'የተጠየቁ ዝርዝሮች', corrDocuments: 'የተጠየቁ ሰነዶች',
  corrLocked: 'ሌሎች ያቀረቧቸው ዝርዝሮች አይቀየሩም. የመግቢያ ኢሜይልዎ እዚህ አይቀየርም.', corrNoFields: 'የግል መረጃ ማስተካከያ አልተጠየቀም.', corrNoDocuments: 'የሰነድ ማስተካከያ አልተጠየቀም.',
  corrDraftHint: 'በኋላ ለመቀጠል የማስተካከያ ረቂቁን ያስቀምጡ. ረቂቅ ማስቀመጥ ማመልከቻዎን እንደገና አያቀርብም.', corrSaved: 'የማስተካከያ ረቂቅዎ ተቀምጧል.', corrRestored: 'ያስቀመጧቸው ማስተካከያዎች ተመልሰዋል.',
  corrDelete: 'ይህን የማስተካከያ ረቂቅ ይሰርዙ?', corrDeleteBody: 'ይህ የተቀመጡ ማስተካከያዎችን ያስወግዳል፤ መጨረሻ ያቀረቧቸውን ዝርዝሮችና ሰነዶች ይመልሳል. ማመልከቻዎና የውሳኔ ታሪክዎ ይቀመጣሉ.',
  corrDeleteAction: 'ማስተካከያዎችን ሰርዝ', corrLeaveBody: 'ከመጨረሻው ማስቀመጥ በኋላ ያደረጓቸው ለውጦች ይጠፋሉ. የተቀመጠው የማስተካከያ ረቂቅ ይቀራል.',
  corrReload: 'የቅርብ ጊዜውን ማመልከቻ ጫን', corrReloadHeading: 'የአሁኑን ማስተካከያዎች ይተኩ?', corrReloadBody: 'ይህ ያስገቡትን መረጃ በቅርብ ጊዜው ማመልከቻና ረቂቅ ይተካል. ያልተቀመጡ ለውጦች ይጠፋሉ.',
  corrConflict: 'ማመልከቻዎ ወይም ረቂቅዎ በሌላ ቦታ ተቀይሯል. ያስገቡት መረጃ አለ. ከመቀጠልዎ በፊት የቅርብ ጊዜውን ይጫኑ.', corrConfig: 'የማስተካከያ መስፈርቶች ተቀይረዋል. የቅርብ ጊዜውን ማመልከቻ ጭነው የተጠየቁትን ለውጦች ይመልከቱ.',
  corrUnavailable: 'ማስተካከያዎች ለጊዜው አይገኙም. ያስገቡት መረጃ ተጠብቋል. እንደገና ይሞክሩ.', corrValidation: 'ከመቀጠልዎ በፊት የተጠየቁትን ዝርዝሮችና ሰነዶች ያረጋግጡ.',
  corrNotReturned: 'ለማስተካከያ የተመለሰ ማመልከቻ የለም', corrNotReturnedBody: 'ይህ ማመልከቻ በአሁኑ ጊዜ ለማስተካከያ አልተመለሰም. የቅርብ ጊዜውን ሁኔታ ለማየት ማመልከቻዎን ይመልከቱ.',
  corrReview: 'ማስተካከያዎችዎን ያረጋግጡ', corrReviewIntro: 'ከታች ያሉትን ለውጦች ያረጋግጡ. ቀደምት ውሳኔዎች በማመልከቻዎ ታሪክ ውስጥ ይቀመጣሉ.', corrReviewButton: 'ማስተካከያዎችን አረጋግጥ', corrSubmit: 'ማመልከቻውን እንደገና አቅርብ', corrSubmitting: 'ማስተካከያዎች እየተላኩ ነው…',
  corrCurrent: 'ቀደም ሲል የቀረበ', corrNew: 'ያደረጉት ማስተካከያ', corrUnchanged: 'አልተቀየረም', corrRemoved: 'ተወግዷል', corrAdded: 'ተጨምሯል ወይም ተተክቷል',
  corrSuccess: 'ማስተካከያዎች ለግምገማ ተልከዋል', corrSuccessBody: 'ማመልከቻዎ እንደገና ግምገማ እየጠበቀ ነው. ቀደምት ማመልከቻዎና ውሳኔዎች በታሪኩ ውስጥ ይቀመጣሉ.', corrSent: 'እንደገና የቀረበበት',
  corrLoading: 'ማስተካከያዎችዎ እየተጫኑ ነው…', corrDraftDeleted: 'የማስተካከያ ረቂቅዎ ተሰርዟል. መጨረሻ ያቀረቡት መረጃ ተመልሷል.', corrReviewNote: 'የተጠየቁትን መስኮችና ሰነዶች ብቻ መቀየር ይቻላል.',
}
