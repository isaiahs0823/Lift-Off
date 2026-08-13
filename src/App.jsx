import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  ArrowLeftRight,
  Flame,
  Dumbbell,
  ClipboardList,
  TrendingUp,
  X,
  Star,
  Search,
  Check,
  Timer,
  Settings,
  Download,
  Upload,
  Camera,
  Share2,
  Pause,
  Play,
  RotateCcw,
  Calculator,
  Award,
  StickyNote,
  Target,
  Scale,
  MessageCircle,
  Copy,
  Home,
  MoreHorizontal,
} from "lucide-react";
import { SlideInPanel } from "./components/SlideInPanel.jsx";
import MissionTab from "./components/MissionTab.jsx";
import ProgressTab from "./components/ProgressTab.jsx";
import ReadinessCheckIn from "./components/ReadinessCheckIn.jsx";
import CoachTab from "./components/CoachTab.jsx";
import { buildCoachContext } from "./utils/coachContext.js";
import { generatePostWorkoutReview, generatePreWorkoutAdvice } from "./services/coachService.js";
import { computeReadinessScore, readinessBand } from "./utils/readiness.js";
import ShareCardButton from "./components/ShareCardButton.jsx";
import TodayTab from "./components/TodayTab.jsx";
import TrainTab from "./components/TrainTab.jsx";
import MoreTab from "./components/MoreTab.jsx";
import { buildPRShareCard, buildWorkoutShareCard } from "./utils/shareCard.js";
import { suggestNext } from "./utils/progression.js";
import { resolveCurrentProgramDay } from "./utils/programSchedule.js";

// B.R.E.A.K. logo (uploaded asset, embedded as data URI so the artifact stays self-contained)
const BREAK_LOGO =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAESASwDASIAAhEBAxEB/8QAHQAAAQUBAQEBAAAAAAAAAAAAAgEDBAUGAAcICf/EAFwQAAEDAwIDAwcGBwgNCwUBAAECAwQABREGIRIxQRNRYQcUIjJxgZEjQlJiobEVFnKCwdHwCCQzQ1OSs7QlJjQ1VWNzdZSVotLTJ0RFVHSDk6Sy4fEXNmRlhKP/xAAbAQACAwEBAQAAAAAAAAAAAAAAAQIDBAUGB//EADgRAAICAQIDBQYFBAEFAQAAAAABAgMRBCESMUEFE1FhcSIygZGx0RQzocHhFSNC8FIGJFNi8YL/2gAMAwEAAhEDEQA/APjrFKBSgUooA7FEKSiA+NAhQKVKd6UDrRJG3dUgQoTRAUqU4HOjCd6BicIwKIJ2ogkZFOcINPAsjaU755DpTgTRJT30YTmgMgBGBmlA399OBB5fbRBIxTFkAJ3pSnepsa2zHkdolrga/lHVBtHxVgU8iDEHouXAOK+hFZU8fjsn7aTklzJRrnN4islYU+FdjFaCDZHJawiHZrxLUeWeFvPuAUav4+gdTOJCk6OLYxzkuO4959EVDvoeJpWg1D/xx67GBxnnXEV6KnQWoRsbJYU+CpKs/a5XL8n+pSnKNM2x8dzD7hJ+CzS76IfgLvL5r7nnRTtSBNbK56Su8NJMzSFxjhPNTbxAH89J++qNyBCQflVXKGf8fF40/FJ/RTV0H1Iy0V8ecWU5RvXEd4q1Fodd9KFJiSx9Ft3C/wCarB+yoMhl1hwtvNONLHzVpINWJpmZpp4ZHI2oFJp/hyaFSaAI5AoVJ7qeKaEjfagMjBG1ARUhQ2psppDyMFOKEinVAb0KhtQA10oSKcIztQkUsAARSYo6Qio4ACkxRGkNAzsUQFcKID4U8CEAowM5rgM70YFMDgDtypxKelckdcU4kcqeBHAeyjSk5pQmjCcmgQiU/dRYOaID30QFMBAmnG0KUsIQlSlHYJSMk0+zHKykuBSEq9RKU5Wv8kfpO1auLptEO1Iueo5jVgtbg9BKiVSJQ7kJHpL92EjqRVc7FHbqaqdLO1cXKPi+RmWIaS4G3VqLn8gwONz39E+858K1kbSNwjwUXC4PW7TMJW6ZM5wdov8AJ4tz+YkmojeqFxGuy0XZmLPGBx+E54S4+fFIOUIPgApQ76oZK2H5ip052VeZyzlyRMdUQo/HiPxT7KhiyfN4LePTU7RXE/F8vkXzk3RESUEx2bvq+bzCyDHZJ8CsKWofmJqS9q7UDKeC32vTem28bFTIedA/70qOfYgVlnJUlaShKww2di2wkNp9+OfvzUcNhI2AqSpguZXPW3SWFLC8Ft9C7nam1JLTiXrq8up5FqKtxtv4AoH2VSyGoD7hXI/CMtR5qdeGT8eKuCaIJ8KsSSMzk3zGhGtIP97HSPF9P+5S+a2c/wDR8pB70Po/3BTnCe6l4T3UCJEKa/Bwbbfr/biOXZPrGP5qx91XsTVuqU4T+M0K6Jxu3dIqHCfznEgj3KrM8NcE70nFPmSjZOPuvBqZd9gSB/bLoZkIPOVaXygDx4V8ST7AoU7Dh2K6pEfT+rG21q9W3XhsNH2DjJR/NXmso0XGVcTDrjSu9CiPup4utPtqbmxGn0n5yRwK+zY+8VW6l02NS11jWJ4kvP78yxv+n5VpeLV0tki3OYyHEJK2lDvwdwPEE1SPxXENdsCh1nOO1bPEn/2PgcVd2O8X20seaWW5JlQT61quKQ4yr8lKjgHxQUqqxiu6Wvb6m+JekL0fR7N9ZMN49wcIyj8lwY+tRxThz3Q+DT3e6+F+fL5mIUOtCob1o9RWCZa5BYukQwXvmuJHyLg6HwB7xkHwqifYcZc4HUFJxnwI7weo8asjNTWUZrqLKXiawRlChUNqcOOXShIqRUR1DahI8KdcHsoSKQ0MkY6UJBNOmgUKBjZFCeeKcKTmhI3pABihxThpKTAQCjApAKNIOaYHDIp1IwN6RIFHTE2Kkb04AaRIGOVOZ5YSaYhUpO4owB03Irkg8gcGnEpUpSW0glROwHM0Ac2klaUpBUonAAG5NXen7DPutwRBt0Yy5a1YwBxIb789CR8B1p7SVgkXiQ4hl5qNFYbLk2c4rhaZbHrHi6J6Z5knAzneTedRMPwXNP6XLlvsA9CVMUjhfuHgQN0t9zYO/NR5YolOU3ww+ZvrohTFWX9eS8fN+C+pJk3KzaadXEsCGtQ6g/jp7nykSMoc+AHZ5Q7z8mPrc6zst12ZcHLld5bt3uTvrvPrKkp8N+YHIDZI7jQBSG2fN46OzZ6jqvHVR6+zkKEYqcIKJnu1E7n7XLw6IJ5brygt5xThAwM9B3AdB4Cg4c8qblSWIyAp5wJzySNyfdUIyJ8vIYT5s0fnKGVn9VTyU4JrzjTKeJ5xLY8TUQ3NlR4Y7Dr57wMCkZt7KVca+J5zqpZzUtKUgYAxQBDL9yc9SOy0PrHJruC5q9aaEfkoFTcVxAowGSH2M087k/8ACuLM8ercXD7Ug1MOAK4UYFkhE3VH8c07+UnFEJspv+HgEj6TSs/ZUzFcDQGRli4w3VcId4F/RcHCamDlnp31FejsvDDjaVe0VG80kRvShSCkfya90mgCzI7xTq3EvNBmY35w0BgcR9JI8FfoOR4VVs3JPGGpjZjudD80++p+xGQcjpigC2suoLhY4hgrR+HNO59OBIOFMA8y2rctH2ZQeoqwnWOBcLQ5d9KvruNrQQZERwcMiEo9FJ34fBQyhXt2GbbWptYWhRSociKegvzYNzRdrHJMC5tggcAHA6DzSUnYg9UHY/ZVcq8vMdmbKdU4x4LFxR8Pt4FbKjdllSCVt5xkjBSe5Q6H9hUYp2rfNot+sYz861MtW+/stlU2178D6B6zjWdynqUn0kc9wMjGzIpZUpSUqABwtB5tnuPh3HrThZl8MuYr9NwR7yt5i/08mQCO6m1Dp0p9QoVJ22qzBlGOGgIwNqfI2oCmkPIxihWnpTyhQKFAxnGKQ5pwihI8BSEcO7rTiU7b0iRinAN+VMDkjupxIpEjenUigTFSMDNGNtqQDHSjGxqQghkbgVf6TsL95mqjoUhhlCFLlyXVcLbLaRlZKuiQPWPuHjX2OBJuNwZixWluPOqCW0oGTucZHiTsK0Os50aPFVomxOpEOOQbxMbORIdSf4JJ6toO31178gnGeyTk+CPxN+nrjVX39i9F4vx9EQ9TXuPdY6bJY0uRdMRFglRTwuT3RycWP/SjkgHJySc05VxJSkAIQnZKRyH/AL+NA+8hCUJS2UoHotNp3JJ6eJPfVsnSWo1aZXqd1h9i0JfEcyg0gtBw/MSVKBcI68IIFWJKCwjPJ2Xycnu2VDjyUOBpKVOOq9VtCeJR91ctEsAh1cKDtzfe4lfBOakMNRxGJQ45GhqPpOD+Gknvz81Pd9gpQmzBt2S3a2URmBlTzqlOLcV3DJx9lQdngaYaP2csgJhQYsYT5UnzlalYCk5ys/VyKkDhOSkEJO4CufvqGgvTJAmShjGzTfRtPsqYBVkc43MlrhxewcK4ipMKG9K4lICEtoGVuLUEpSKt4lpiJZEhTbkpH8o4exYH5x3V7qUpxjzYVUWXPEFko40Z+S52bDS3V9yRmrJuyONrSmY+ltauTDQ7R1XsAqe2+gnso6XZCeXYw0Flr3rPpH3AVNYiznGihS24DKvWaijhKh9ZXM+81mnq0tkdrS9hWW7zfy+/2yRkxIkRAS5Ft0b6XnzpW4R4hGeD2mmLhaYZbS8UrgpX6rqD28ZX56eXvor5bokWAlLDZTxLAUSclXtqojsvQne1tst6IvrwK9FXtHI1Gu6UlnJfquzKqn3fD8U9wpVnnR0F0tpeZ6OMnjT9nL31B4RV1GvLkdzjm20pX1lW5XZqPipv1VfAVLQq13dZLRjTlq6IxGkj2oPorPsNaFcupybNBKL9h5/RmZxS1dTLGkLKYkkFwDJYfT2To9x2NUqkqSspUCkg4INWpprKMU4Sg8SWGMSFxVLRHkox2hwFqHoez21zUFyE+ppm5RABv2D6lJI9hxRvtIeaU24niSaO2Ph1JtM9hiS4E5iuPJzn6pPOoTbW6LqFCfsyW5zjjzCeKVGU23/KtqDjfvI5e+nElKkhSSFJPIjkadhRoC1Yil21TAeEthZW2T3FJ6Hwo7ZZpd1vjNptqFMXGSsITFbCCl1Z9VTZUQkA/fSjYmWWaSUVlAJU+ZLEqHIXFuUdQXHkNq4VcQ5b9/cevI+GoUtjWNtenxo7MXUMJsm4w0p4USG+ReQn6OfXSPUO429XMXi33OwXN623mM6w804WnA632a21j5i09D3dDRMPS481i7W59TFzhq7Rtwb8QHeOu2xB9ZOR7ScVNZRGi+WnliSynzXiivlxy0rKUqCCSMHmk9Un9t6infatxfmYN9s6dTWiN2TbiuyuENByYr2M4H1TupB6jI5g1i3my04UEg45EciOhp12cSw+aDVadVNSg8xfJ/t6oZx0oVCnFUJ5GrGZRlY6U2RTyhtTaxSGho91ATvThoTjxoBipFOgYNCgU6kYG9AmEgDFEEnFIkU4kZzTQgkpxgUbaeNYSAT3gc/Z76Q7J91aTQFqam3Tzic52EKMhUiU9j+DbQOJSvaE8h1JAqFk+COTRpKO/tUXy5t+CLHt1aP0qiSyeHUF4SpuHw+tGY9Rbw7id20fnnoDWSZbTFYEdBylO6iOqv1DkPj1qVers9f75Lvr7XYh4huKwDtHZSOFCB+SnA8SVHnUUF1T6WIwSp8jPpeqgdVK8BUa4qEdyWpud9nsrZbJeRufJFo22X5iZqvVFyFu03aglU15KvlXOPPBGYT1cWEnKugofKBrSXr24xwYqLZpm3I7C0WpnZtpocvbnGVK5qPhWQZcZbiNMPyQm2tnIC1cPnCxnfH0Rkjx5U85ebbknzgKPchB/VVU5vkjp6bTwWHJ/wC/71FuMUS3EJWpQbSkqITtuMAVXSUOSY8bgH7zbHGoDqrkAR4VcIeadDTra8oWk8J7/wBsV0OK9FW+vsUuQ30khPEArj6gDxqNbw9y/WVucHwFSkbUbSStYQOZrpDbsd5bLzZbWk7pVzHdVlYYLkt4NoQpal4yEjKsE4CQOqiSAB4itUpKKyzgU0yumoR6mu8meirxq+W/DszaS7HhvSu0cb40tJQk4UR9JSsIT4knkKgptTLriJUmRImKWkLQXlZwCM48K+0/IFoIaB0UlmWhsXi4FL88jfgOPQZB+igbeJ4j1r5j8p9l/F/Xl8tCUBDUaassgDYMufKN49gXj3Vh1MJKPF16nqOxtRVZqHSl7KW3w5v1fMzDaUtpCUJCQOgFENqTnSjPWsJ63BVan/uFB/xgqjNXmqD/AGPR/lU1RCtdHunA7Q/PfojhkCmJERh/dxsZ+kNjT9dz2q05735hW5yVxKjypT0uGhAPA76amgTgFCuYI5+6kvEUt5UTlaPRWRyUOih7quNMMpVFkPqSMOqKR+SNqZdZWSuG6AXGQVNZ/jWuqfan7jUIXcNjXQnquzO90sZLm919viv1MyMGmJTC30p7A4fQribI6EVMltdi8Ug5Sd0nvFS7OhxIW95solQIacUQEZ7v27q3trGTy1cJSmormR54TObLystTI7YUopPJXPBPXl9tWD7SXWWyVlp1HpNOp5tq/Ueo943qK5Hchw3G3wO2VkrPeo0Uq5Q4rwZkOlKsAnCScVk9D0ajHhameqWqbE8sFqTprUbrETXsRkMwJrysN3hoeqw6r+U29BzryO9ePkPW+e7AWpwOMHKSoYUnBIKT4ggipDlxt8jswzOQ0+2eJh0ZSWz+keHvFR5YfLzktSCXgB501nKgOjiT85J5/b7LoS3OTqaEk8bllp68I0/efP3mlO2qcnze5R0DfgJzxJH0kn00+wp5U5rGyG2XFxhtxD7CgHYryPVdbUOIFPgpJCh76qMpcaKchSHBzH2H3c60unHlXnSknT0j++FmBehq6qjFXpIHf2a1cQ+qs9BRYuF8aFo5K1PTz5Pl5P8AnkYlRzuCcikxnB5VIlNlt4gp4eInI7j1FNEbZq9NNZRglFxbi+aGVA00oe2n1imyKQIZIoSDTihg0CsZ3oAMDkM06gYFNp508nNMXUJPIUae/FBkYwM86IHbwpiDSntHUNjfPTvrVamcVY9ERbQ1tLvSw673+bNqwAfBboz7GqrdE25d11BFioHpOuobSegJOAfZuT7qkXZiZrnygOMWBt6QlbwiW5lpPE6plscDQSO8pSVEnYcRNZpPis8kdOtOrS7e9P6L+SiR2i1eaxQFLQn01nZLY71GjWpplgIaStxtw8zsuWr9DYq/1npa6aMu7+n7nbFtyogStcZJ4kL4hkOKX85Ps6g91VMdlxClynT28lQ5nYDuA7hSnNss02lS35+f2CLDENlE24pEiY6B2LWM4HTCegqZDuV+eWlv8HQZAP8AFFAz8ahxYykvGRIcLr6hus9B3Dwo77KMS3NR4quGTIWfTHNKRzNVrd4N8oquDm9sEpxkNK7d+A7AYY4nHG3eRyeSVdRzqJNjXW+OiWVIhNtj97tqcCeEdCR+iqxqW6kCPdXFy4SzuVH0mz3+ytRp5duQ4LRdgyoP/wBwz1DPETybWengalJOCzjJRTOOqkoOXCv3IokouEUwp7HBcoqPRwchxPt6pqXbp6rRe4bEXeTGcTKWsH/nCCFtp9xT8TUuVbJFtmLdebBVGbUG1KHpDrg+HWsytJjstykqUpxDgfUo8yc5NVqzvPRGp6P8MnxL2pc/T+ep+nFluca9WaDeYagqPPjNyWiPorSFD76+ev3Wdl7DUlrvrTfyc+IqK8oD+MaPGjPtStY/NrdfuVb2m7eR+JBUvjds8lyCc8+zyFte7gWke6rD90ZZTePJXcH2kFUi1rRcG8c8Nn5Qe9srrRZHjraONo7XpNXGXg/4PkMbbVxpXkhLhCTkZ2PeKCuQfSir1PtAQf8AGpqjJ5kVd6o/vej/ACqapK1Ue6ef7R/P+CHFLjPsokREOJbUMKS4oEhQ57imHVFLalJGVYwB4nlVvpu0ty9OX2UwFmRbX2nn0f8A47vodpj6rnCD4ODuqBFa7a5xmMHAXxqHgP8A3q+Wyyc6pu2XB1zg01uYEaCyzj1UDNVmqZCmEodaHykZHaJ/LUoBI+AVV2PSIA68qymoHQ7NSnOzkgn8xscI/wBoqrHSuKeT0HaDVen4F12EWiC6lq4ODEJwFwjixwKHrI+P2VXzm5uocusqRDhND5BJVwlZ6Kx3VNsrHbOzoA9JlbYdDZ5BWcVbJiQbZb1XC9oStBPC2ykbuL6NoHfyyelanc4+xzOA+z425uzwp835r7lBHckTWDa56OCc0nLK8+i6B3HrU2RIuEVkvwtOhJWcqkyk7np6KTyHuqqujojLTKebQZ7pJjRGyeCMn9uvWq9mbcYUpuZImOvo4gHkqOQAeoq5Qb3Oe9UoYhJlx5+X3A1qGIwphwYS82gfJmo81ly1yG2XHfkE+lFlJ37MHoe9B7ulWM1tlweiAppwZx0qFGZdbbVDc+WiEEo4ju34DwqGTVOrKwRHW1tla47BQU+k/GBzgH57fek91La7u5ab5Av0UB4R1+m30dRghbZ8FIKk/CiDEll5uO2l11oHLS0eux3+1PeK0N68nepWtGR9bItbrdpmKKRJSPk1EKwFLTzQFK9VXI++rozysM5d2ncHxR2f+8hnX1tYi3AyISy7DkpD8Zz6bakhST7SkjPiKy2dhWxtbn4Y8nIaxxSLJI7DxLDnEtr4KDqf5orHrSErKRyB29nSinbMPAevSnw3r/Jb+q5gLApsinD1psirmc8BdNEb706fCgO55UgDTjfvp1GOdNCnQNqYgkgb1ysBJOM0mBiuO6gkDmR76B4y8I2ekgq06WvV9Ts7HhKbYP8AjXiGUkeIC1qH5NUmirzM0terbqK0rLUyC6l4nmCkH0TjuxsR3GrzVi/MPJnbYSNl3C4qWrxTHaCR/tvn4VlEHgWFI9HGw9nLFUUrijl9Tpa+fd3KEf8AFJfc+2fKJpq1+XDye2zXmjnGU32K0ezbWR6XVyK73b54Se/PJVfKV5tpZfkFph1hbCy3KiOpKXYrg5pUDvjPWrDyP+VS8eS2/CdbVdvaJBSidAdV6Cx09mN+FQ3GcHI5/ScnSmhfLpBk6v0revMNSq4Tg47RlCUAdk81nDiM5PGO/ntiiUc+oabUdz5x+h8kKPA0pz6KSappnE5dXCrcNNpbT8MmvWvKL5N9UacW81e9OSYycECdAbL8NzxPDuj3/CvK7g2W5SztlXCdvZj9FRrWJbmnX2qdKcXtkZICklKgMGhiOpigw5g7S3u8+9o948KUmuUApJBGQa0OOUcaE3B5RtIFxlSbS5ap60yiwxmJNCvSW1j1F95HQ1QhvtYqW8cRUjGKZ0g6WLgq3rUVNPtLDGT6i8Zx7DU+C2soZQElKnGzxHnwJBIUr25BArC48Emj1Fd/f0QecvdfQ+hf3D16fbvF4sTpJTKt7b+M5CXGHOzJ96XE/wA2vqSWwzLhvRJCQtl9tTbiT1SoYI+Bry39z5oSNoHQDl6vIYt86WyJE119QSIjCRlDalHlwglSvrE9wq/0f5WfJpq6QuLYtX29yUlZSGJKjHcXjqkLxxA+Fa4bLc87qZKdrceR8nagsZ0/eHdP3SY1BnRVqZaRLy15y2kkIcbUocKgUgHY9ar5UCXHQFvMLS2r1VgZSfYobGvtzWGkbHqu2m3ahtMedHO6Q4jJSe9KuYPiCK+cPKx5G5mgbJJv+kbpJctTJBkQ3VklCSeZ+atHQkgKGc5ODWO3SLdxPR6D/qB7V3LyyeJ6qOLej/KpqmQkrUEJBKjyA61bancQ/bmnWx6DjiVJ8PD3cqhW+Q9FkcTIcJV6HC2rgUtRGyeLmkY3ON+Q61CnaO5u7QfFdlb5SwbLyJITZvKbbvxgjcNkvbLlnnocWElTcgcKVYO+y+A56YqHftPPab1/fLJIUFOWt8xSsfPxuFe9JBqkEeYwtu5LCC7HdQ8lpPLKVBXM5JO3Mk17Z5fLHDRqiPq2K80zA1XERdW3pTgbS0rgQFoUT4FCh13UKlOXHU1Ey0UvTa6Dt2Uk/mjyx99MVlx9X8WkqHtA2rJymXvPCVgFMdtLOc81Y4lH3kmte0m13Vt+Pa7pHuLrQ+WQ0lQ27059YeIqgdbMbiS6grcjp4XEjm6x0UPFP3Yqmr2HhnS7Q/vQU63lIZ0y61HvEmQ+FKabYBWlOOIjOcDxqHqK8PPzEXCY2gzVo4YUJByiM3+vvPWnlkQmrnJIQ6hLCAg52WVer94rPMNKC1PPrLj6/XUfuHhWuqGZtnntfqe7ohBPnl4+PP7CsNLC1PPrLr7hytZ+4eFG8gONqQRsoEGiFLWtHn223lkqxuFdojJWcqCVJ/mqx+mrCMw9JeS0wgqWeg+/2UukLPJuJjsxok2Y4QopYhx1OurKldw2A25mvobyZ+QG83hsS9Xtp03Y0DjdhpeBlPpG/wAq5ybT3gb+znWXhbex6BaiFdUeJ74Md5EPJg5r67COkrbsUZ0G5z0gjzgjfzdo/eeg8cVffuv/AChxUpjeSzSy2m4cEjz4s7IStAwhoAfNbG5+twjpU7yreWizeT7TY8nHkreZdWhTjLc9o+iwha1K4GlH1lDix2h2GNsncfM7ilqW4t1wvPunLrpJJUc5wM74z8TuaujHGyOZddKT45c+i/cvPJkpKNUyLOB8hdoDkdKSf4xCe1a95W0R+eaoL0z5vOW2R84gezmPv+yihz12i92y7NetClNvj8xaVfcFVe+VeCiDqeY02Pk0PrSg96QohJ+BFRl7NqfiW0/3dFZHrFp/PZmSJ26e6hV0o9uHnTZ3IzV5zQFcvfTR506RkZ6UHuNIA0jFOJoE+2jHtpgKTv405AR2tyYR9YU2dhk1J0+OK+NDuBP2VC14g2aNJHj1EI+a+pofKYvhc01AAwG7b25/KdfcVn+ahFZzNX/lT21rGjg/wFqgo/8AKoUftWaz/WlUsRSDWT475yfVsYnpDimW1DIK8kewVKsd1vWnLg1PsFwkQn2lcSFNuFJSfAjcVGe3kt+CVH7q0OiYFunS7k5dGZD8eFbnJYaYdDalqDjaAOIpUAPTzy6VKWMZZVXxcSUeZ7BoT91lqq1toj6ttca9tp2Lqx2Tp9q0DB96c14/ra8WW+ajuN0s7fmsaXKceZiqXxKaClFXDnAyBk/ZUtw6RUMfi5eMf51a/wCBSxfxNZc7Q6Vuzh8bs2PuYqpTjnmbnpr3Fx4OZl9+6uxWzE3RR5aOumP88p/4VKV+T6Z8i9a7/ZSeUhD6JaB+UnCFY9mT4VPvYeJQ9DelnhMV2yor7EtHrsOpcHsB3+zNfSf7mPQ9n1Hr+VNkKQ9EtJamuMq5uuLJLIx9BJSVHvPD414LqzT6rM62BKamwpTXaxZTWSh5BJGQfAggg7ggggGvZv3GuozF8pFnjOuYbusB62O7/wAa38o2T7kEfnVXYk5xZq0lko6e6tc8Z/Z/owP3WPlJ1JqXWdx0GkOWvTtqkdk8whz0prgweNwj5u4KU8hzO/LxB2DFcACmk7ciNjXqX7p2IYvlz1RgHhccYdzjbKmUV5gV91Qm/aNmkriqlhcza6H8rXlM0MG27DqeRJhI2EC4fvhnHcArdP5pFe9+TX90zYtWSGdNeULT7dmdnHzcy2V9pDWVDGHEq3QDnGckDO+K+UUKJ5AmgmoWqE7woJIGdhRGbRG7RVyWVszceVaFZtP6zu2mrNO/CtrjTwYsmMQtISrdTXETuUnbI2ODVRYXrXBty75eJB7PtS0iMzhT5WdyMHlsB6R2xjnRyWkNxbehCRw9ojkPCoF/jNi7NKbbHFwKUrCfZvWVWKx8OOZ2nprNNBWcWXFJb+f2Jc3WlxdCm7DaItqaUMds6O3fI9qhge4VU3F65XduKi93adckRGg1HRIeUpLKAMBKAThI25Ch3B5b0oO9XpKKwjDNux8U3l+YyllyG+3MtrhjSmTltaNq0S57t8gs3RMTsJ8dWHMEdm6euO4EcxVJnJwBk9wq0tR7PSKgDhx1RQnv4lKxVduyTNWiWZyj0w3j6EHUvmjUCGxDCw3Mc85UlXNKUjYfE/ZVOavIMdm5+Ue02h5RMRcuLblY6JWtIWR4+l9lXMqXotuS6hrSF0LaFqTveU5ODj+RrTS1CCz1OD2hGeq1Mu7W0dvl/Jixypt1aUNKUpQSMcya0OvIMC36gDNradZiORI0lDbrnGpPasIcKSrAzgrxnA5VQcAdIb4eLiOMY51ozk5LWHhnsfkh8u1p8mOkJlptthZudzlyO1ckuuq4AlKAlCQlIycbn1hzrI+Unyz+UPXylMT7o5Ft6j6MRkdmyPzBz9qiTUaZp6xacEeLd4k6ddHGg9JjxpKGExAoAoQoqQoqWU+kRtwgpzuTiyhwtFfi5cb3NsV1iRoyOyZcN0QsvylA9mylPYjJ24lHPopBPcDUnHOMm6ULXHvVHC8TzGWwGme2KlOOhxKlLUck71bZzvUCeCqE7nnw5IFSmFcTDZ70j7qtMLed2N3FPHFIP0gPjkfprZ+UxYmWu0XMbmVbIjyj9YsJSr/aQqsdLP72X4YP2itZqU9t5M9MugnKbapo/mSn0/diqLv8X5nS7Oee8h4xf6bmHSrKfdSn9FA36ntoyNjjoO6tBzQOXfQE70ZoDud6QB5yNqNJA3ppOBjJp1OMdaYCq2Gc/GpWmgDfUdfQUfsNRFmpelzm/NAnmlX3Gq7/AMtmzs9/91X6ovPKof8AlGfxy8yhgf6IzVBV75U1Z1wy/jAetkFft/ejY+9JqgBzTh7qKL1i2XqwF/3SPyD94rT6DJCtQ462J3+nYrML2dQrvCh91aTQZ+U1D/mN3+nYon7rHp/zY+qJOnISLlqG2W11ZQiZMZjqWkbpC1hJI9maOZf9DRpj8cWTUbnZOqb4vPGcHBIz6nhTdguDdr1BbLm62txuHMZkLQjHEpKFhRAz1wKkPW7yeuSHXV3XUxLi1LOLY1zUon+W8ay1cP8Akd7Xy1EZLueRG/GbQ2MfgDUg/wD7Wf8Ah1IvcK3Jh2672Z99223FpS2kyEBLrS0KKXG142JBHMbEKB25BBbPJ2cZuep/9WNf8am7tNhvNQLXaI8pq229taGDJKe2eW4srW4oJJCcnACQTgJG9SsUMeyVaOeqlbi3OAnlB/ydXBD6wG7fdYzjWfmB9DiXPYCWmz7q9v8A3H2lrfN1hKuEuQx51Y0IkNRR67q3AUh4D6CRsMdVDuGfEtbNnTujk6bmo7O83Sa1NlRj68aO0hYaDg+apanVK4TuAkE+sKLyPa0uum9SwJ9udAultJMYLPoy2D68dfeCOXuPMCjeMYyfJFblGy22qHvS5P6r4n2F5e/JWNaRF3mzNtC+tNdmpteyJrY3Daj0UD6quh2Oxr4ylxbSxJcbXOeLrayhcdEVXaIUDgpJPo5BGOZr7D8qvldgueR2JdtGvrXd9StqjwWU7uxOj6lgeqpvdOfpFJ5V8uM2Ew2UiQqHCAGCZElCT7Tvmo6i3haUVlmjsjSzsjJzlwxX1KaIopI8ytMdGf42YrjI8eEYH30EN2ddVutqkKXDK8HCAlK8dEgDYH7dvfdTIQRGS626xJiu5CXmF8SFY2IzUN6Q3abXIlhACWkYbT3rOwFYu+m/Z8T0H9PoglY3mK39f4KfVF6nLmiFbpjkZiCUkdkrGXRzVtzxyqxbfdu9rjXdkhM5GUPKxzWOefBQ3rM2/wA0bHFOS6ou5AKDvxnqfCrXRsgxbrItLhw3LSS2TyDidx8Rt8KvnDhh7PQwUXqy5qzlLZ/Hl8i2s5ul3Hm8aPFuElLqWTHkt/KKUsgI4FpwTknAzmrzyqaIToLVCbDeZLKJao6XyqGovtoSokAKBCVJOx232q+8kj0LTl3uuvJUZpz8Xrct2Mlac9pPePZRkgdTkrV4BJPSs0uNKuk6TPvN8iSrxLWHJXnk1IfUojqFHbwHQYFHetQzjLZD8JxahwUsRjs34vp/JQwm0FS02t1Ml3kqSG1BLAPdxAemfs9tWP4OUmA1HiqSlbB7RClEYyN8nNPKtc6xzBMXEWbc8OzlONELSgE7L9HPI7+zNBqRyOwy9AeeAjspDlweQc+jzS0k9SrbPtHjVUnKxp9DfTGvTwknvL9vt4+hBsSWleULSE1sIQmdeYq0ozuFB5PER9XPWoMzeZI7u0X95qNomU7P8qemZryQgqvMNLbY5NNh5OEipE3eU/gfxi9vea2OLjFJnD01sLb7JwWzx/8AfjzHvKSf7Y2By/sTbv6mzVjpKC1p+0J1hcWmnn1rLdniODKX3hjLqx1bbyCe88Kepw7Pl6Ku78WddmdRolIhxY7rcdlkoyyyho8KisEg8GckbZqvvV1dvVzMpbCYzDaAxDioOUxmE54Gx3nckn5yiT1qyVqUdjBToJ2XNzWEO2O3TdR3wtuSwXn1LkTJklfooSMqcecV3AZUTVPrK9x71cGI1rQtqxW0Fq3NrGFOZ9eQsfTcIB8AEp6Vca4kfi7bXNGRFYuMgJXf3k/MwQpEMH6pwpz62E/NOcYNhgU6a8bsh2hqu8l3cfdQEoDzZwfVP3U9F2itfkCmJR/ezn5NSGxwtpT3DFXHMBmf3K5+Sa1t0yfJPYCejMoD2edr/WayE3+5VjvAHxNbDUGGfJdp1rBybe46fz5j36AKpv5L1R0uzPzJP/1l9DBsn0AKMc/dTTBwkd9O4wM1cc0BRHTFCfH7qKhJoJIVOc5pwZppOelGnbwpiOOM46in7C52d/jK6FWPjTKsY9tNNuFmY06PmrBzUZrMWi2ifBbGfg0a7ynI4ntNTx/HWtLSj4tPPN/cE1mwcCtjrloyvJ7b5iPSNvuTzKvBD7aXEf7TTlYoKyAe+oUvMEX9oQ4NTNeY4vcJPcr7wf8A2rSeT/HHqLP+Anf6dis03k5SOo+7f9FaPQJIc1Hj/ATv9OxUp+6ynT/mx9UP2OELnfbdbC52YmS2o/HjPDxrCc464zUiTM8nceY9HXP1QstOKbJTbWcEgkH+P8KDSUuPC1ZZp0x0Mxo1wjvOuEEhCEuJJO3cAabm6Qtz06Q8Nb6cw66twYfVgAqJ+j41mqjFrc7naF99Ul3YQuPk8H/PNVf6tZ/49SbpAszlhYvmn7jImwHHjGeTIY7J6O6E8QSpIKhhSdwQTnB5EVAGjLaeeutOAf5ZX+7UuaLXZdNjTlru7N4ckzUzZkphtSWW+BtSENIKgCo+msk4x6oGd6lZCCjsUaPVaqdqU+XoSnFL1bpu5MXRfb3a1RfPIkxQy8/HQUpcZcVzXwJIWlR3ASocsY85UpbbiXmVlt1tQUhaTukjka9B0m4Iwvk9Y+RjWGaXCeXyjfYpHvW6msXYbY9c15BShpI4lrUcBIHMmp0vMNzL2hWoajEC8jy4l2jKuC7bIbcBS3JUZyWGVOEZ2GCTnGdhU1uNGYnxYbtot6W5sJUxl9p1bqilK1IwSoDqhXTuqPaZEJx92BETxR2MK4iMBxfLJ7zj4fE1baiJRqDSYSQAqyPD/wAzIrLLhzKKXJHZoVqjVdKWXKSTWEMadmZdER5KGUzUZAQnhbUsbg4GyVYyDjntR3RhUhoISQFNq4kgjIyO8U1BYYdtsJciS3FabAJeXnCCDtyGedWbUZ55akMoU8pOSeBJOw6+ysc5Pi4keh01K7p1yeU0n8/5M4phtyRx+bqZSpSGggnIBIPER4E8qdgxlPPxipJbLBHGs83FA7Y7hjFWMxJ4oyeEkmQjp7aktxH3w4WWXF8CeJZQknhHee6pO+TXqU19n1Kfjw/7uLOv5NiXEj5ajRpypDqiP4eRjs29uqUJ4iPFaqpuNKYM6Q/DjOIjMh5LTiMrWSTkuKG5Jx37dKnohRlNobXJabdSrjajkHLpHMjAxtnrUG8q4bdfSCNoqEn35qcZ8TSwU20d0pTzvv8APDf2HWo7aVRAbdDYflx2ng3Eua2VFLqQpKfTHDkgjbNZ++T2H+C2QYkiJCjLKlNvkFxbvIlRGxA5D31tb20hFutqiAFC0QVAp2I/ezZGD0NZd1pm/RjMi8KJScl5GAOI8yfb1PxHhrpcXN7cjz2uhdDTwalnjWXss/8AwXydn/lH0r43mJ/TJqZLP75f4ufaK+81D8n4LflM0ok4BF5i5z/lk1Kmn99SN9+0X95q27oVdkf5fAublB0haHY8a96kmsS3IrMlbbNuU6hAdbS4kcXEMnhUM7c6h6itJtchDYfRKiSWUyIklvPA+yseisfaCOYIIO4qL5UEpOpWOIA/2Itv9SZp7QEr8LwToWY6O3K1P2FxZ5PHdcYnolzGU9ywPpGlKpcOUOjtGau4bORLviDqnTqrxlS75a0JRchjJlMZCW5PiobIX48KvnGsXWotdwmWG8tXCO2kvx1KS4y6PRdQQUuNLH0VJJSR+qo2tbTFhymLlaSpdmuSC9DUo5UjfCml/XQrKT7AeRFTpnxLDM3aOl7qfFHkzOPjKAk/OUB9tPimgOJafDJP3fpp2rjmjM1QDSQTzWPs3/RW28pAMTTlqgbgxrTCZI7lKaDqvtcNY1iG7dLzb7UyMuS30Mp9q1BA/wDVWo8sVxbmXmUpgjsXZbhaA/k0nhR/spFZ7t5RXmdTs9cNd1j6Rx83gxLI2GacVuOeKbaziiJ6ZNaDliDnQk70R9WmzuaRJCp57050xmgSRk0WcnnTIi4HDvTEgbE09vim3gcGgD0LTv8AZrRV1toHG4/bi+yP8dGV2nxLXbD3159FPyfD1ScVqvJjeFWy4NvBPaKgyESktnk4gHC0ewpyPfVZrS0t2DV8+3MOF2J2nHEc/lGVALaV70KSaz1bNxOnr13kK711WH6rYrgopUFDmDkVqfJ6I67pe4b0+DCVLs7rUdcyQlltSi6yoJ4lEAHhB+FZTOadLSZEQ5AK2unen9s/ZV0llYOfCThJSXQ3K9MK3H4zaS/13H/3qROlvRydT6S5/wCGo/8AvV5wWW8+on4UnYt49VPwqjuEdP8Aq13gj0j8VE741RpA+29x/wDepF6ftkFPbXLWml2GR6wYm+cr9yWgo5rzZTbX0B8KsdPWJy6yilIS2y2OJ1xWyUJ7yf27hvR3EQ/qt72SRq7pc4d1tqtLaSakeYPOJeuNxlJDa5PB6qQkE8DSSeLBJKlY7gKo5cxPZG0WzKYqVAPPAek6odB+gdPbk11xkscKrZZ+JENCsOv4wp0j2fd0+Jp1hEW3QhKlJ8GWhzWf25moznwrCLaKJWydlj9X+yLazWtyPB87DBS0TwBXQHu+yu8os5dtnaQmJaS4EWpYUgnHEDKkAjPTamLCi5PKk3OclXAspaSBsls7kJHuBoPK/jstK/5pV/W5FUVRfetS32Ojr7UtDXOpYxLb4ZJIlfhPT/m8FIkW9C+IKVs9H5ktrxzGeRqTe25jNohPlL7KXgHkLBKeNKUZ2PXesjYYGqICm7rbrbKWysYyGipt1PVJHUVdtSFLJErSd7aTggIYWpSE554SpO1Snp5J5RXp+1q51uM9m9nzx8PsT9QuPgxVtrcaIWXgUkjkBv8AbTt6cfZmROFTrYQrtVgKIyOJI379iajLdjyWA3MY1i6ENltpLkTj4Acct/Cm5ktb7nE/bNWXAhvs0qkN8HCO4bHA2qtUSWNuRsn2nTLi9pe1jx6fAsrjGmxdRRkmC4t9lAcSyr0StKlEe4EVnNX3ttLEuE0pEiZJIEt1vZpoJ5NoHXHU/wDzUW832SI7saFbX7epz0X33HVOOrH0eIj0R31nD/BkeFXVUYxxHM7Q7WVmY1deb/Tb4bZPYLu320a2NkAcVogp3OOcVqsZNYlWufxNJLclBwMcnB3Hx8f2O01AFGPbG20lal2eAlKRzJMVoAfE1i2nHozn4JvoWlCVFDTyhu2QfUV+21VQT45NHQ1DremphLZtLD8ORa6QdgvavsF6cWGG4l0juy+PbskpcSVKPgACfYPhcydNNuSHeDVmkCFLUQTe2ORJx86sZMakxJnGwrgfTyPzXU9x8e41yIUK6xlOxm0tyEH0m8Ab9R+3u7hpWJ4ycduzSSlwrfr90W3lLdjL1V2UWbEmojwIUdb0V4OtFaIrSFBKxscKBG3dWXcSVAFClIWkhSFpOClQ5EHvoeDsCUFPDg4xiiznlWlLCwciTcm2ehpkw9bRGruu72a2XsDsrqzOmIjB50cpDfEQFcY3UByUFHkoVZWizw27TOsV11PpJcCUC+w4L0wpUSUlPouABWSlYHAoD6p5prygtoUrKkgnxFOxoqHXMBCQBuTjlVfdJPKNb11kqu7ksokZAQCkpIJO6TkHG366HOaRRTxYQMIGyfZQOudm0pfPA28asMRpfJaxx6skXlQ+Ts0R2WD07VI4Gf8A/ZxHwqh1a92l2DAVkMJCPfj/AOa12lGhaNAdu96Lt1kF5Xf5vHyAfYp1S/8AwhXnzzxlTnpCua1k1nXtW+h1Jf2dCl1m8/BfyGgbUewwcb13Ic6QnJxWk5gi9ximlc6M7jOaaVnPMUhocBGaMcqaQacHdTELvQqGQaX37Vys9KBBWiWYF3Yf+ZxcKx3pOxrb65gqumkIt1aHFKsy0w5GPnR1kqYX7iXGz/3Yrz15PSvQvJ3eoqohZuYU5CW0YVxQN1GOvHpj6yCErHigVnt9iSmdTR/36pad8+a9V0+KMKhQUgKHI09Fe7F9LhHEnkod460/qS0S9Oagl2aYElbLhAWj1HEndK0nqlSSFDwIqDnerkzmNYZIuLAZeyg8TaxxII5EVEUrAqxgqbks+ZPKCTzZUeh7vfUeJBdemFpzDYSfTKjskd9DGll4Q7YbS7dJJHEllhscTzy9ktp7yf0cydhU27XVt1H4Hs6lNW9o/KLAwp5XLJ8fDpn2kxL7dgpgWe1YbhoOVqHNxX0j+ju95JG0BiNCdkupyhrfH0j0Hxqmctsm/TUpz4M79X4ImtCLbYaZEhO52ZZHNR/V41ClvrjufhG4kLkq/gmRyT3DwA/bwackKZxc5vykhz+Bb6JH6v29lTIddkvqffVxLV9ngKjCHUu1Oq2UYrCXJfu/2PTNGvOyfJvMkPEKcXfE5OOQEdWAPCqnyvZ7LSwJ/wCiVf1uRVnoY48mEj/PY/q5qs8sGOy0p42hX9bkVXH89+houbfZcG/+T/ct7xdbrG0to9mHdZ8RtNnz2bEpbac+cv74SQM+NV8W56qkhSo96vzwGyiiY8cfA05fh/a9pP8AzOP6w/Tjd1utn8l1zftFxlwHl3uKhTkZ5TalJ7B88JKSCRkA4qLzKxrJdCUKdJGxxzsAJWsyr++Oo/8ASXv10j8/WEdvtHbrqFtA+cqW8APtrMDW+tOf43X/AP1g7/vVY6Y1trM6it6VX263FC5LaFxJMhbzT6VKAKFIUSCDnHvqzuH4mVdp1/8AjLy2auuQ/euoFqv1qX6LzEs8bqU/SbdPpJUOm5HeCKyuv7Q1ZNRyoMd4PxhwuR3QMBxpaQtCgOmUqBx05VfasixoWp7tDhkKjMTXmmiDnKErIH2CoflNSBH004TlxdiZ4/c68lP+ylNGnsbbix9qaeEIxsgsZN5ISF3HTiVYIMC15/8AAZrzzUU9LerLzBnenEXPfCFK37P5VX2fd8QfRHM/hDTOQN4Fq5f5JqvL9agK1dekq/6/I/pVVGlZlP1Le05uNOna/wCP2JbbxiBNvuJ4oyv7nkZzwg8gT1FNS2pESQJDZAeSMhXzXU9x8fH9NV1umIbQLfccriK2Qvq0f1eHTn7bKIXGXFWl9QWCOKK4TnB549lTlFxeUU02xuioS+D6p+H2JTio96i9uwA3KRstHef1/fVMpKm1lKsgjpQFT0ST51G9FxJ9JPRQ54/buq242bxH7dgBLyR6aeuavjLHM51kOJvC3XNfYrU86sFfvaGG+TjvreCf2/TQQI6WuOTKGENck9VK7v2/RTDzy3nVOrxxKPIch4VNmbkdmnbTbpN8v0GywgDIlPJbTnkFE7E9wG6ie4VFdcShBUen21t9DW5Vn05I1BIITMugciQc822uUh72Y+SB+s53VCc1FZZdp6JX2KEeo35TrnEQgRLWo+ZIbRChd5jtDhCj4rOVnxUawcdOAByqVfpxuN1UtH8C36DY7gKZQBgYPKo0xaWXzZfr7o2W4h7sdl8AiDwmkVy37qU5G1IVZq4xAk7HemlHJ6U4s02TvypEhUq25U4DnamAadQe+hCYYpSd6QVxpiEdHo5orNONtuSHyCpo+i6nvSedd82oz6KjKKksMnXOVclOPNHp2orejU+kkBgl262WP2jChzlQAc4Hepkk/mE/QrzRC8ggjChsRWl0BfpESUxHRKMeXGcDsF478Kh8055g8sHY8utSfKDYmAn8abGwGrdIc7OVETuYMjGVNfkHdSD1Tkc0mqK24vgZv1lcbYrUVrZ814P+TIOFXAeAZV0x31Lnrk+YsFXGW3EjtXyfW8PtqIhWQFpPiCKsoMkLbWytPEyofKtAer9ZPh3gcvZkVbJGSmSWV1Y5HeZYbMR2Aytk9S3gj2LG4Pt2NRp7eI0WIgEdq7nB5kCp7MZDbKfN71AUyPVS+jiUkd2f0VFuK2o7vnr1xYlvBBS0hkAAH2DlVLTb5nRi64xaSxn6FTc3Q/PWR/Bt+ggdwFRSaVOyd+Z3oTVqWFg5dk3OTkz0rQx/5MpG/wD00Nv+4NVvldyGtKE9bQr+tyKneSZ2PdLLP0r5y2xcHZbcyChw8IkKCFIW0Dy490kDrggb4Bt7vYGdVR4thkOrt+orchbEIPDDUpsrU52R+g4FKXjOygQNiN83u379UdrDu7MShu4vcpr7/wDb+lMHP9hx/WH6CyaglWiDIhIg2ybHfeQ8pubHLgStKVJCk4IIOFqHvp2/gJ0/pMBQV/YYbj/tD9O2yZDsug7hfHrJAu0lN0jxEJmFzhQhbTqyRwKTvlA51DEna+E1RlXDRxdiysIRWrX1HP4t6Y/0FX+/Tg1pcmm8wbXYrdJScolRYOHmz3oUoq4T4gZHQiqtvyhww4jtdB6dLXEONKFSEqKc7gHtTg464NSdXWyLbroF255T9smNJlQHiN1sr3GfrJOUqHRSTUrHbBZbKtN+DvliEd/Mjadstxvk4Q4LJWcFbrqzhtpA3UtajslIG5Jqp8pV2g3TU7v4KWpy2RGm4cNZGCtppAQF46cRCl4+tWq1JcbldvJRHat0tcVi0uiPdIbCQhMlC1FTL68br34kHiyAUo6msz5P9Ks6hXMmz7giDa7cEKluY4lkLJCUoT85RIwB8SACaspgox4jF2hdO6xUpcv1PR3/AEblpcH/AAfav6FqvLtaq/tzvR//AGEj+kVXrMIxplwav88/grT9pEdHaPKyQ0ylKW2gfnuqSgbDqSdgNvFrvLM+7S5pTwmQ+t0jOcFSirH21DT7uUujZf2xiMKam94x38hsgLbKT15VKQ6VW6PI37SI6EE9eHmP1e6ojZqRb3GW3n40lfAxITjjPJKhyP31olyOVp5Yljx/1fqXaDHYffdXG7ZxWC1xIKkgc9kjmd/ZUCW663LafjMoZkqOOFAwFDuIFWAQrgbYF8ty0JSAkuJBUB3ZHOkcYjxnS61OanTSP4RGzbSe8/RA/wDjJ5QinyZuucJNzisPx8CDclyfPmg6HEpLeVNKPqK/YU1xUUh4LVwpWpaQclahgrPf4DuHSgixpVxnM263suPyn1pbQ22nKlKJwEgdSTsKuisLc5lklKba5Flo+yK1JfkxVveawI6VPzZRGUsMo9dfiRkBI6qUkda0PlG1AhbQaiseaIcZTHhxgc+bRUbIT4qO5J6qKj1q1nItulNOuWNh5t1DK0ru8ptWRKkp9VhB6ttnO/JS+JXIJry+fLeuVwdmv+ss7DokdAKof92fkvqdNL8FRl+/NfJfyAwnAFSgNtqBtOAO+nRnlWpI5Iitjg91AeVKvc7nehOTzNDBALVTajvRqx30BOTSJCA04knpTQNEk0APIOdqPpg00g4pwHrigWBRuKFxG1KFb4rjzxTEQ3ApCgtB4VJOQR0Nei6G1Eh8O9vHblLW12NxhLVwpms5zkHosHBChukgHvzgXEbE0y26/FlIkxllt1s8SVDpVNtfEvM1aXU9xJ5WYvmjT6400LI63c7W6qZYppJjSOHCkkes24B6ric7j2EbEVm0rIIWhRBG4Ir0XSGpI86JIYchtym30gXG1qVwpfA5Otn5rickhQ5ctwSKz2sNJrtTCbzZnV3GxPr4UP8ABwrZXz7J1PzFj4KG6SRyjCednzLNTpe7SsreYPk/2ZQmbJ5laVHPrKbSSfeRmpkKXbpLa4t2iIHHjhlMoCVoI6kDn+3OqkEK3HKjA2FW5MRIvNlk29IfSpMmGvdEhvdPv7jVXVxa7rMtqz2CwppXrsrGUK9oqY6zp+77sL/A8tXNC92VHwPT9tqAM1k7EbEbgivV9AeUyCqZCRrhDzr0JSVRbuyjjeHDyQ8n+MG2OP1h14unnd0sF2tySt+ItTPMPNemgjvyP01V7GoyinzLarZ1PMHg9GvmRpzSJPWyjH+kv03cgf8A6Q3LPS/xP6vIqPbteW9qyWy3XLR1vua7fHMduQuW82pSONaxkJVjYrNQ9Tayj3XTarFb9Nw7RHcmNy3VNSHXFLUhC0JHpk4GFq+yqY1tT4joWayuWkVS57GSAFehaFk/jBpKXpd0gz7YHJ9rJ5rb5yGR7h2gHgvvrz2plkuUyzXiJdre6WpcR5LzSsZAIOdx1HQjqKtlFSWGYKLXVYprobTTF0YtV0KpyFPW2W0qJcGk81sLxxEfWSQFp+skVZ6bdsvk/f1ZZtUqflcSorkJmKnacEqUpJCzshCkrSri3ODsCaqHNdWFx1bqvJ3aQVqKiEzZASM9w4thVVrrVTOpkWxDNii2tNvjebI7J5xwrRxFSQorJPo8RA8MDoKrrraTjLkbtXq4TnG2raSGtaauuuq5jTk3s48OOCmJBjp4WIye5I6k9VHKj1NUQFdHaefcDbDS3VnklCSo/ZV5H048ygP3iS3bmjyQo8TqvYkVcl4HNlJyeW9yojoW46lptClrVslKRkmtA3a4dtZTIvKg6+RluGg5PtUen7c6U3WJCZMaxxOwBGFyXPSdX+qqpRUtZWtRUs7lROSafIiPGW7xZQ2yygeqhDYwPiCSfE0D0h5xHAtwlGc8IACc+wbU2a6IxKnTGoMCO5IkvLCENtpKlKUdgABuSe4U0wBHaOOJZYSVurICUgZr06yWxGiYDzBcSnUjzZ89kE/3qZUMFsH+XUDhWPUB4fWJx1gtcfRKV9m4w/qZCSZEwqCmbT3hJ5LkdMjIb6ZVunBamvYnfvGAVJhJVlSifSeV1Uo1nnNzfDH5nTophpoK+5ei8fN+QxqK6/hOQliOOCEx6LSO/wCsfGobTeOlNsowKkpG1XwgorCOfddK6bnN5bCRilyMdaHpSb91WFZysZzTajvRKPOmzUWNAqNCT7RSq76GgBAaIGmxmiBoAeB60edt6aSaLO9ADu3SiPfQZ250QO1ANCKGaadb508Ph41yhxZzTEQ2lvRZCJEdxTTrZylSTgg1v9IarU+8tKVx4895HZSI76QqLPR9BaTtn4EHcEHesM4gFNRVoOcjY9DVNlakadNqpUNrmnzT5M9Eveiot1L0zSSHmZyAVSLG8oqeRjmWT/HI8PXHUK9asEviSstuIUhY2KVVe2XVTjaWot5Dj7TZHYyWzh9kjkQeuK3FyftOqIHbaga/CG3o323pHnSP+0NbB32nhX9Y8qrVjhtP5mqWlheuPTP/APPVenieTmgO9a286DvEOA5dbW6xfLSj1pcIlXZD/GIIC2z+WB4E1kzseHke47GrU8nPlFxeGTbbeLnbhiHMcQjqgniQfcdqnG826YP7K2OOtR5uxiW1e3HWqM5pDmmRLkxNMyP4G4TIaj819riHxFKjTsZ/+59Q2w+Dq+zNUhriB3U8gX34oTDum62RQ8Jo/VSHSjyN3rzZkDwlBX3CqLA7h8K4AdwpbAXf4FtDJ/fWomD3hhorogrS0UZajTrg53vLDaPgN6oxRA08gXi9QTEtlqCzHt7XdHRg+886rVuLdWXHVqcWealKyT8aYB3oisAZP20sjHR31xXgZJAFSLLbbnfJzcCzwJE6S56rbLZUT47dPGtnatGWq1SknUUsXi4JORaba6FJQe558ZSnxCOJXimoykorLLaqbLpcMFlmY0xp266lkrRCbSxEZAVJmPq7NhhH0lrOyR3dTyAJ2rdQ12jS1pdTYZK2G1JLcu+PI4H3wdi3GRzbQeRPrqHMpHo1C1XqqNHjtw5BjLRHUVR7RAHBEjq+ko5JWrvUoqUe+vPbtc5t2k9tMcyBshsbJQO4Cqsys5bI38NOi3n7U/DovXxJuoL65cuGJDQY1vb9Vsc1+Ku81XNN4FC0jFSUJ2rRCCisI5t107puc3liJTinDkA7Vw2pCSdqsKjjsN6Ek1xIzv0oVGkNCH2UBpSdqEnakMRW1BmuVzoTQBwpR30INLmkA4k0afHNNJNEDTAdScU4k5FMA70Y5bUAPdKU7745UANGjfrigWAcZ59abU2MVIA23oVCmBAWjc05bpk22yhIgyXGHB1Sdj4EdafUjNMrbFRcRxk4vKNfYtbttym5EgyLRcE7Jn29RR/OSOnfj4VpF/grULan7tZ4V4Srcz7MpMaSPFbWOBR/NSfGvJlN78q5hb8Z0PRnnGXByUhRSR7xVDq4fdeDfHX8axfHi/R/M3U7RNrkLP4A1PFUv/qlzT5o8PDKiWz7l+6qK76O1Nam+1m2SYhk8nkNlTR9ix6J9xro+r7qAEXBuPcmx/1hvKv5wwau7LrS3wlcUV282RxXrGDJPAfdkZo4prmsh3Wms9yfD6/dGHU2pJ9JKk+1JpNvpJ+Nep/jg1PHy96s1wz/AIVtLaln2r4eL7aIOWqVu5p3RMrxZlPMH4B0D7KO9XUX4Gb92SfxPKsHwPvrik94+Ir1YwbCeehrMr8i+OY/9Rokx7G0Mp0TppvxfvDy/ucFHexH/T7/AAXzR5QAOQUD7N6kRIM2Y6lqJDkSHFHAQ22ST7udenLu9rhj0IWh4JHVMYyVD/xFLFR5Ovwy0plOqLiGzzZtcdMRs+HoBP3Ud74Jj/A8Pvzivjn6FAx5O9TpSl27sw7AwoZDl1kJjkjwQr01e5Jq8tOl9JRRxH8I6qkp/kUmHDSfFax2ih7Eo9tZqVq2IlxS4FmbU6rm/MWXVk9+OVU9xvl5uSSiTNd7L+SQeFA9w2pf3JeQ0tJU925/ovueh3nVUW3wnLc5NiQ4ahhVpsaOzQvwdcyVL/PUqsVdtVz5jJiQGm7bCIwW2fWUPrK5mqJLXXrTyG/CpRpSeXuyFvaFko8EPZj4IZQ3g9576fQjqRTiW6cAAq9IwNgoR1NHnuogOVdjxpiAPOkPOlPhTajmgZyiKHqc0SEqcWltCSpSiAANySaevEF+2z3IckYcbxv0ORzFRGRSc0JNceVATTA4npQmlpD76WQBHKiB6UGcUopAOA1wNDmlpoAwaNJprNEDTAdB32qQgjwqKk04lXjQMkDc0ppoK3xRpO3jQRZyh4UChnmBR5rsA0xDKkZAxTZb51KwBypAkHnvQBFLXhQFrPSppSM7ihKKWBkHsaEs1PLfhXFsUuEMkDsj31wZJ5mpvZilS3jpRwhkhhil7ECppbFL2eTRwhkiJapxLY7qkJQNs0oQMcqeAyNIa3oko35U6BXDagQIHfSn2UuaEmmMXPSkUaQnG9ApVIEhFHFNk0qzTZNAzV6BlWRm4NplsLTNUcNPLVlAPQAdD4nNW/lFlWQJQxLYW9PCcoLSglSB9Y93hXnWSCCDgjup2dKemSnJUhfG64cqJoAZzQk12+a6kB3ShpSaQ86QAUXSurqQBJohXV1MDlUSeYrq6mAY50Yrq6gA0cxRo/TXV1CDqEP00XWurqYmd8+urq6mhBd9Ia6upgd191Ca6uoA6lHP3V1dSALr7qQV1dQAp9auP6a6uoAShV+iurqQHD9ND311dQSAVyoD+murqQIBXq0Jrq6mME86E11dSEJ31x511dSAHrQq511dSA//2Q==";

// ---------- Exercise library ----------
const EXERCISE_LIBRARY = [
  // Chest
  { id: "bench", name: "Barbell bench press", type: "compound", muscle: "Chest" },
  { id: "incline_bench", name: "Incline barbell bench press", type: "compound", muscle: "Chest" },
  { id: "decline_bench", name: "Decline barbell bench press", type: "compound", muscle: "Chest" },
  { id: "db_bench", name: "Flat dumbbell press", type: "compound", muscle: "Chest" },
  { id: "incline_db_press", name: "Incline dumbbell press", type: "compound", muscle: "Chest" },
  { id: "decline_db_press", name: "Decline dumbbell press", type: "compound", muscle: "Chest" },
  { id: "smith_bench", name: "Smith machine bench press", type: "compound", muscle: "Chest" },
  { id: "chest_press_machine", name: "Chest press machine", type: "compound", muscle: "Chest" },
  { id: "incline_chest_press_machine", name: "Incline chest press machine", type: "compound", muscle: "Chest" },
  { id: "pec_deck", name: "Pec deck / chest fly machine", type: "isolation", muscle: "Chest" },
  { id: "cable_fly", name: "Cable fly (mid)", type: "isolation", muscle: "Chest" },
  { id: "cable_fly_low_high", name: "Low-to-high cable fly", type: "isolation", muscle: "Chest" },
  { id: "cable_fly_high_low", name: "High-to-low cable fly", type: "isolation", muscle: "Chest" },
  { id: "db_fly", name: "Dumbbell fly", type: "isolation", muscle: "Chest" },
  { id: "dips_chest", name: "Chest dip", type: "compound", muscle: "Chest" },
  { id: "pushup", name: "Push-up", type: "compound", muscle: "Chest" },
  { id: "svend_press", name: "Svend press", type: "isolation", muscle: "Chest" },

  // Back
  { id: "deadlift", name: "Deadlift", type: "compound", muscle: "Back" },
  { id: "sumo_deadlift", name: "Sumo deadlift", type: "compound", muscle: "Back" },
  { id: "trap_bar_deadlift", name: "Trap bar deadlift", type: "compound", muscle: "Back" },
  { id: "rack_pull", name: "Rack pull", type: "compound", muscle: "Back" },
  { id: "pullup", name: "Weighted pull-up", type: "compound", muscle: "Back" },
  { id: "chinup", name: "Weighted chin-up", type: "compound", muscle: "Back" },
  { id: "assisted_pullup", name: "Assisted pull-up machine", type: "compound", muscle: "Back" },
  { id: "barbell_row", name: "Barbell row", type: "compound", muscle: "Back" },
  { id: "pendlay_row", name: "Pendlay row", type: "compound", muscle: "Back" },
  { id: "t_bar_row", name: "T-bar row", type: "compound", muscle: "Back" },
  { id: "chest_supported_row", name: "Chest-supported row machine", type: "compound", muscle: "Back" },
  { id: "single_arm_db_row", name: "Single-arm dumbbell row", type: "compound", muscle: "Back" },
  { id: "seal_row", name: "Seal row", type: "compound", muscle: "Back" },
  { id: "lat_pulldown", name: "Lat pulldown (wide grip)", type: "compound", muscle: "Back" },
  { id: "close_grip_pulldown", name: "Close-grip pulldown", type: "compound", muscle: "Back" },
  { id: "single_arm_pulldown", name: "Single-arm lat pulldown", type: "compound", muscle: "Back" },
  { id: "seated_row", name: "Seated cable row", type: "compound", muscle: "Back" },
  { id: "high_row_machine", name: "High row machine", type: "compound", muscle: "Back" },
  { id: "iso_row_machine", name: "Iso-lateral row machine", type: "compound", muscle: "Back" },
  { id: "straight_arm_pulldown", name: "Straight-arm pulldown", type: "isolation", muscle: "Back" },
  { id: "back_extension", name: "Back extension / hyperextension", type: "isolation", muscle: "Back" },
  { id: "good_morning", name: "Good morning", type: "compound", muscle: "Back" },
  { id: "shrug_barbell", name: "Barbell shrug", type: "isolation", muscle: "Back" },
  { id: "shrug_db", name: "Dumbbell shrug", type: "isolation", muscle: "Back" },
  { id: "shrug_machine", name: "Shrug machine", type: "isolation", muscle: "Back" },

  // Shoulders
  { id: "ohp", name: "Barbell overhead press", type: "compound", muscle: "Shoulders" },
  { id: "db_shoulder_press", name: "Dumbbell shoulder press", type: "compound", muscle: "Shoulders" },
  { id: "arnold_press", name: "Arnold press", type: "compound", muscle: "Shoulders" },
  { id: "seated_ohp_machine", name: "Shoulder press machine", type: "compound", muscle: "Shoulders" },
  { id: "smith_ohp", name: "Smith machine shoulder press", type: "compound", muscle: "Shoulders" },
  { id: "push_press", name: "Push press", type: "compound", muscle: "Shoulders" },
  { id: "lat_raise", name: "Dumbbell lateral raise", type: "isolation", muscle: "Shoulders" },
  { id: "cable_lat_raise", name: "Cable lateral raise", type: "isolation", muscle: "Shoulders" },
  { id: "lat_raise_machine", name: "Lateral raise machine", type: "isolation", muscle: "Shoulders" },
  { id: "front_raise", name: "Front raise", type: "isolation", muscle: "Shoulders" },
  { id: "rear_delt_fly", name: "Dumbbell rear delt fly", type: "isolation", muscle: "Shoulders" },
  { id: "cable_rear_delt_fly", name: "Cable rear delt fly", type: "isolation", muscle: "Shoulders" },
  { id: "rear_delt_machine", name: "Rear delt machine (reverse pec deck)", type: "isolation", muscle: "Shoulders" },
  { id: "face_pull", name: "Face pull", type: "isolation", muscle: "Shoulders" },
  { id: "upright_row", name: "Upright row", type: "isolation", muscle: "Shoulders" },

  // Legs — Quads/Glutes/Hams
  { id: "squat", name: "Back squat", type: "compound", muscle: "Legs" },
  { id: "front_squat", name: "Front squat", type: "compound", muscle: "Legs" },
  { id: "box_squat", name: "Box squat", type: "compound", muscle: "Legs" },
  { id: "smith_squat", name: "Smith machine squat", type: "compound", muscle: "Legs" },
  { id: "hack_squat", name: "Hack squat machine", type: "compound", muscle: "Legs" },
  { id: "goblet_squat", name: "Goblet squat", type: "compound", muscle: "Legs" },
  { id: "leg_press", name: "Leg press (45 degree)", type: "compound", muscle: "Legs" },
  { id: "vertical_leg_press", name: "Vertical leg press", type: "compound", muscle: "Legs" },
  { id: "pendulum_squat", name: "Pendulum squat machine", type: "compound", muscle: "Legs" },
  { id: "bulgarian_split_squat", name: "Bulgarian split squat", type: "compound", muscle: "Legs" },
  { id: "walking_lunge", name: "Walking lunge", type: "compound", muscle: "Legs" },
  { id: "reverse_lunge", name: "Reverse lunge", type: "compound", muscle: "Legs" },
  { id: "step_up", name: "Step-up", type: "compound", muscle: "Legs" },
  { id: "rdl", name: "Romanian deadlift", type: "compound", muscle: "Legs" },
  { id: "stiff_leg_deadlift", name: "Stiff-leg deadlift", type: "compound", muscle: "Legs" },
  { id: "hip_thrust", name: "Barbell hip thrust", type: "compound", muscle: "Legs" },
  { id: "glute_bridge", name: "Glute bridge", type: "compound", muscle: "Legs" },
  { id: "hip_thrust_machine", name: "Hip thrust machine", type: "compound", muscle: "Legs" },
  { id: "cable_pull_through", name: "Cable pull-through", type: "compound", muscle: "Legs" },
  { id: "leg_curl_seated", name: "Seated leg curl", type: "isolation", muscle: "Legs" },
  { id: "leg_curl_lying", name: "Lying leg curl", type: "isolation", muscle: "Legs" },
  { id: "nordic_curl", name: "Nordic hamstring curl", type: "isolation", muscle: "Legs" },
  { id: "leg_extension", name: "Leg extension", type: "isolation", muscle: "Legs" },
  { id: "hip_abduction_machine", name: "Hip abduction machine", type: "isolation", muscle: "Legs" },
  { id: "hip_adduction_machine", name: "Hip adduction machine", type: "isolation", muscle: "Legs" },
  { id: "glute_kickback_machine", name: "Glute kickback machine", type: "isolation", muscle: "Legs" },
  { id: "calf_raise_standing", name: "Standing calf raise", type: "isolation", muscle: "Legs" },
  { id: "calf_raise_seated", name: "Seated calf raise", type: "isolation", muscle: "Legs" },
  { id: "leg_press_calf_raise", name: "Leg press calf raise", type: "isolation", muscle: "Legs" },
  { id: "donkey_calf_raise", name: "Donkey calf raise", type: "isolation", muscle: "Legs" },

  // Arms — Biceps/Triceps/Forearms
  { id: "barbell_curl", name: "Barbell curl", type: "isolation", muscle: "Arms" },
  { id: "ez_bar_curl", name: "EZ-bar curl", type: "isolation", muscle: "Arms" },
  { id: "db_curl", name: "Dumbbell curl", type: "isolation", muscle: "Arms" },
  { id: "hammer_curl", name: "Hammer curl", type: "isolation", muscle: "Arms" },
  { id: "incline_db_curl", name: "Incline dumbbell curl", type: "isolation", muscle: "Arms" },
  { id: "preacher_curl", name: "Preacher curl (barbell/EZ)", type: "isolation", muscle: "Arms" },
  { id: "preacher_curl_machine", name: "Preacher curl machine", type: "isolation", muscle: "Arms" },
  { id: "cable_curl", name: "Cable curl", type: "isolation", muscle: "Arms" },
  { id: "concentration_curl", name: "Concentration curl", type: "isolation", muscle: "Arms" },
  { id: "spider_curl", name: "Spider curl", type: "isolation", muscle: "Arms" },
  { id: "bicep_curl_machine", name: "Bicep curl machine", type: "isolation", muscle: "Arms" },
  { id: "close_grip_bench", name: "Close-grip bench press", type: "compound", muscle: "Arms" },
  { id: "skullcrusher", name: "Skullcrusher (EZ-bar)", type: "isolation", muscle: "Arms" },
  { id: "tricep_pushdown", name: "Tricep pushdown (rope/bar)", type: "isolation", muscle: "Arms" },
  { id: "overhead_tricep_ext", name: "Overhead tricep extension", type: "isolation", muscle: "Arms" },
  { id: "db_kickback", name: "Dumbbell tricep kickback", type: "isolation", muscle: "Arms" },
  { id: "tricep_dip_machine", name: "Tricep dip machine", type: "compound", muscle: "Arms" },
  { id: "bench_dip", name: "Bench dip", type: "compound", muscle: "Arms" },
  { id: "jm_press", name: "JM press", type: "isolation", muscle: "Arms" },
  { id: "wrist_curl", name: "Wrist curl", type: "isolation", muscle: "Arms" },
  { id: "reverse_wrist_curl", name: "Reverse wrist curl", type: "isolation", muscle: "Arms" },
  { id: "farmers_carry", name: "Farmer's carry", type: "compound", muscle: "Arms" },

  // Core
  { id: "plank", name: "Weighted plank", type: "isolation", muscle: "Core" },
  { id: "hanging_leg_raise", name: "Hanging leg raise", type: "isolation", muscle: "Core" },
  { id: "hanging_knee_raise", name: "Hanging knee raise", type: "isolation", muscle: "Core" },
  { id: "ab_wheel", name: "Ab wheel rollout", type: "isolation", muscle: "Core" },
  { id: "cable_crunch", name: "Cable crunch", type: "isolation", muscle: "Core" },
  { id: "ab_machine_crunch", name: "Ab crunch machine", type: "isolation", muscle: "Core" },
  { id: "situp_weighted", name: "Weighted sit-up", type: "isolation", muscle: "Core" },
  { id: "decline_situp", name: "Decline sit-up", type: "isolation", muscle: "Core" },
  { id: "russian_twist", name: "Russian twist", type: "isolation", muscle: "Core" },
  { id: "wood_chop_cable", name: "Cable woodchop", type: "isolation", muscle: "Core" },
  { id: "side_plank", name: "Side plank", type: "isolation", muscle: "Core" },
  { id: "landmine_180", name: "Landmine 180", type: "isolation", muscle: "Core" },

  // Full body / Olympic
  { id: "power_clean", name: "Power clean", type: "compound", muscle: "Full body" },
  { id: "clean_and_jerk", name: "Clean and jerk", type: "compound", muscle: "Full body" },
  { id: "snatch", name: "Snatch", type: "compound", muscle: "Full body" },
  { id: "kb_swing", name: "Kettlebell swing", type: "compound", muscle: "Full body" },
  { id: "thruster", name: "Thruster", type: "compound", muscle: "Full body" },
  { id: "sled_push", name: "Sled push", type: "compound", muscle: "Full body" },
  { id: "battle_ropes", name: "Battle ropes", type: "isolation", muscle: "Full body" },

  // Conditioning — running, sled work, rucking
  { id: "run_easy", name: "Easy recovery run", type: "isolation", muscle: "Conditioning" },
  { id: "run_tempo", name: "Tempo run", type: "isolation", muscle: "Conditioning" },
  { id: "run_intervals", name: "Interval sprints", type: "isolation", muscle: "Conditioning" },
  { id: "hill_sprints", name: "Hill sprints", type: "isolation", muscle: "Conditioning" },
  { id: "stair_climb_intervals", name: "Stair climb intervals", type: "isolation", muscle: "Conditioning" },
  { id: "sled_drag_forward", name: "Sled drag - forward", type: "compound", muscle: "Conditioning" },
  { id: "sled_drag_backward", name: "Sled drag - backward", type: "compound", muscle: "Conditioning" },
  { id: "ruck_march", name: "Weighted ruck march", type: "compound", muscle: "Conditioning" },
  { id: "stairmaster", name: "StairMaster", type: "isolation", muscle: "Conditioning" },
  { id: "treadmill_walk", name: "Treadmill walk", type: "isolation", muscle: "Conditioning" },
  { id: "treadmill_incline_walk", name: "Treadmill incline walk", type: "isolation", muscle: "Conditioning" },
  { id: "treadmill_jog", name: "Treadmill jog", type: "isolation", muscle: "Conditioning" },
  { id: "elliptical", name: "Elliptical", type: "isolation", muscle: "Conditioning" },
  { id: "stationary_bike", name: "Stationary bike", type: "isolation", muscle: "Conditioning" },
  { id: "rowing_machine", name: "Rowing machine", type: "isolation", muscle: "Conditioning" },
  { id: "jump_rope", name: "Jump rope", type: "isolation", muscle: "Conditioning" },

  // Arsenal Strength line
  { id: "arsenal_incline_fly", name: "Arsenal Incline Fly", type: "isolation", muscle: "Chest" },
  { id: "arsenal_standing_chest_press", name: "Arsenal Standing Chest Press", type: "compound", muscle: "Chest" },
  { id: "arsenal_iso_incline_press", name: "Arsenal ISO Incline Press", type: "compound", muscle: "Chest" },
  { id: "arsenal_wide_chest_press_1", name: "Arsenal Wide Chest Press (1)", type: "compound", muscle: "Chest" },
  { id: "arsenal_converging_chest_press", name: "Arsenal Converging Chest Press", type: "compound", muscle: "Chest" },
  { id: "arsenal_pec_fly_rear_delt", name: "Arsenal Pec Fly / Rear Delt", type: "isolation", muscle: "Chest" },
  { id: "arsenal_wide_chest_press_2", name: "Arsenal Wide Chest Press (2)", type: "compound", muscle: "Chest" },
  { id: "arsenal_upright_decline_fly", name: "Arsenal Upright Decline Fly", type: "isolation", muscle: "Chest" },
  { id: "arsenal_lever_row", name: "Arsenal Lever Row", type: "compound", muscle: "Back" },
  { id: "arsenal_iso_multi_row", name: "Arsenal ISO Multi Row", type: "compound", muscle: "Back" },
  { id: "arsenal_vertical_row", name: "Arsenal Vertical Row", type: "compound", muscle: "Back" },
  { id: "arsenal_pulldown_high_row", name: "Arsenal Multi-Grip Pulldown / High Row", type: "compound", muscle: "Back" },
  { id: "arsenal_scorpion_high_row", name: "Arsenal Scorpion High Row", type: "compound", muscle: "Back" },
  { id: "arsenal_diverging_row", name: "Arsenal Diverging Row", type: "compound", muscle: "Back" },
  { id: "arsenal_seated_row", name: "Arsenal Seated Row", type: "compound", muscle: "Back" },
  { id: "arsenal_iso_shoulder_press", name: "Arsenal ISO Shoulder Press", type: "compound", muscle: "Shoulders" },
  { id: "arsenal_viking_press", name: "Arsenal Viking Press", type: "compound", muscle: "Shoulders" },
  { id: "arsenal_shoulder_press", name: "Arsenal Shoulder Press", type: "compound", muscle: "Shoulders" },
  { id: "arsenal_standing_lateral_raise", name: "Arsenal Standing Lateral Raise", type: "isolation", muscle: "Shoulders" },
  { id: "arsenal_linear_leg_press", name: "Arsenal Linear Leg Press", type: "compound", muscle: "Legs" },
  { id: "arsenal_linear_hack_squat", name: "Arsenal Linear Hack Squat", type: "compound", muscle: "Legs" },
  { id: "arsenal_leg_ext_curl_combo", name: "Arsenal Leg Extension / Seated Leg Curl Combo", type: "isolation", muscle: "Legs" },
  { id: "arsenal_belt_squat", name: "Arsenal Belt Squat", type: "compound", muscle: "Legs" },
  { id: "arsenal_power_squat", name: "Arsenal Power Squat", type: "compound", muscle: "Legs" },
  { id: "arsenal_glute_bridge", name: "Arsenal Glute Bridge", type: "compound", muscle: "Legs" },
  { id: "arsenal_ghd", name: "Arsenal GHD", type: "compound", muscle: "Legs" },
  { id: "arsenal_standing_calf_raise", name: "Arsenal Standing Calf Raise", type: "isolation", muscle: "Legs" },
  { id: "arsenal_donkey_calf_raise", name: "Arsenal Donkey Calf Raise", type: "isolation", muscle: "Legs" },
  { id: "arsenal_lying_leg_curl", name: "Arsenal Lying Leg Curl", type: "isolation", muscle: "Legs" },
  { id: "arsenal_seated_leg_extension", name: "Arsenal Seated Leg Extension", type: "isolation", muscle: "Legs" },
  { id: "arsenal_seated_iso_bicep_curl_1", name: "Arsenal Seated ISO Bicep Curl (1)", type: "isolation", muscle: "Arms" },
  { id: "arsenal_seated_tricep_extension_1", name: "Arsenal Seated Tricep Extension (1)", type: "isolation", muscle: "Arms" },
  { id: "arsenal_tricep_kickback_dip", name: "Arsenal Tricep Kickback / Dip", type: "isolation", muscle: "Arms" },
  { id: "arsenal_seated_iso_bicep_curl_2", name: "Arsenal Seated ISO Bicep Curl (2)", type: "isolation", muscle: "Arms" },
  { id: "arsenal_seated_tricep_extension_2", name: "Arsenal Seated Tricep Extension (2)", type: "isolation", muscle: "Arms" },
];

const EX_MAP_INIT = Object.fromEntries(EXERCISE_LIBRARY.map((e) => [e.id, e]));
const MUSCLE_GROUPS = [...new Set(EXERCISE_LIBRARY.map((e) => e.muscle))];

// ---------- Default templates (RP-style split) ----------
const DEFAULT_TEMPLATES = [
  {
    id: "tpl_push",
    name: "Push",
    exercises: [
      { exId: "bench", sets: 4, reps: 8 },
      { exId: "ohp", sets: 3, reps: 10 },
      { exId: "incline_db_press", sets: 3, reps: 10 },
      { exId: "lat_raise", sets: 3, reps: 15 },
      { exId: "tricep_pushdown", sets: 3, reps: 12 },
    ],
  },
  {
    id: "tpl_pull",
    name: "Pull",
    exercises: [
      { exId: "deadlift", sets: 3, reps: 6 },
      { exId: "barbell_row", sets: 4, reps: 8 },
      { exId: "lat_pulldown", sets: 3, reps: 10 },
      { exId: "rear_delt_fly", sets: 3, reps: 15 },
      { exId: "barbell_curl", sets: 3, reps: 10 },
    ],
  },
  {
    id: "tpl_legs",
    name: "Legs",
    exercises: [
      { exId: "squat", sets: 4, reps: 8 },
      { exId: "rdl", sets: 3, reps: 10 },
      { exId: "leg_press", sets: 3, reps: 12 },
      { exId: "leg_curl_seated", sets: 3, reps: 12 },
      { exId: "calf_raise_standing", sets: 4, reps: 15 },
    ],
  },
  {
    id: "tpl_upper",
    name: "Upper",
    exercises: [
      { exId: "bench", sets: 3, reps: 8 },
      { exId: "barbell_row", sets: 3, reps: 8 },
      { exId: "ohp", sets: 3, reps: 10 },
      { exId: "lat_pulldown", sets: 3, reps: 10 },
      { exId: "hammer_curl", sets: 2, reps: 12 },
    ],
  },
  {
    id: "tpl_lower",
    name: "Lower",
    exercises: [
      { exId: "squat", sets: 4, reps: 6 },
      { exId: "leg_press", sets: 3, reps: 12 },
      { exId: "leg_extension", sets: 3, reps: 15 },
      { exId: "calf_raise_standing", sets: 4, reps: 15 },
      { exId: "hanging_leg_raise", sets: 3, reps: 12 },
    ],
  },
];

// ---------- Hero programs (multi-day, goal-specific splits) ----------
const HERO_PROGRAMS = [
  {
    id: "prog_superman",
    name: "Titan",
    tagline: "Classic hero V-taper — chest and back lead, legs never skipped",
    weeks: 12,
    days: [
      {
        label: "Day 1: Chest",
        exercises: [
          { exId: "bench", sets: 4, reps: 8 },
          { exId: "incline_db_press", sets: 3, reps: 10 },
          { exId: "arsenal_wide_chest_press_1", sets: 3, reps: 10 },
          { exId: "cable_fly", sets: 3, reps: 12 },
          { exId: "dips_chest", sets: 3, reps: 10 },
        ],
      },
      {
        label: "Day 2: Back",
        exercises: [
          { exId: "deadlift", sets: 3, reps: 6 },
          { exId: "barbell_row", sets: 4, reps: 8 },
          { exId: "lat_pulldown", sets: 3, reps: 10 },
          { exId: "arsenal_seated_row", sets: 3, reps: 12 },
          { exId: "straight_arm_pulldown", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 3: Legs",
        exercises: [
          { exId: "squat", sets: 4, reps: 8 },
          { exId: "leg_press", sets: 3, reps: 12 },
          { exId: "rdl", sets: 3, reps: 10 },
          { exId: "leg_curl_seated", sets: 3, reps: 12 },
          { exId: "calf_raise_standing", sets: 4, reps: 15 },
        ],
      },
      {
        label: "Day 4: Shoulders & arms",
        exercises: [
          { exId: "ohp", sets: 3, reps: 10 },
          { exId: "lat_raise", sets: 3, reps: 15 },
          { exId: "barbell_curl", sets: 3, reps: 10 },
          { exId: "skullcrusher", sets: 3, reps: 10 },
          { exId: "rear_delt_fly", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 5: Chest & back pump",
        exercises: [
          { exId: "incline_bench", sets: 3, reps: 10 },
          { exId: "t_bar_row", sets: 3, reps: 10 },
          { exId: "pec_deck", sets: 3, reps: 15 },
          { exId: "lat_pulldown", sets: 3, reps: 12 },
          { exId: "cable_fly", sets: 3, reps: 15 },
        ],
      },
    ],
  },
  {
    id: "prog_batman",
    name: "Reaper",
    tagline: "Lean, athletic, low body fat — trained like a detective, not a bodybuilder",
    weeks: 10,
    days: [
      {
        label: "Day 1: Full body functional",
        exercises: [
          { exId: "pullup", sets: 4, reps: 8 },
          { exId: "pushup", sets: 4, reps: 15 },
          { exId: "goblet_squat", sets: 3, reps: 12 },
          { exId: "kb_swing", sets: 3, reps: 15 },
          { exId: "hanging_leg_raise", sets: 3, reps: 12 },
        ],
      },
      {
        label: "Day 2: Pull & grip",
        exercises: [
          { exId: "chinup", sets: 4, reps: 8 },
          { exId: "single_arm_db_row", sets: 3, reps: 12 },
          { exId: "face_pull", sets: 3, reps: 15 },
          { exId: "battle_ropes", sets: 3, reps: 30 },
          { exId: "ab_wheel", sets: 3, reps: 12 },
        ],
      },
      {
        label: "Day 3: Lower body & core",
        exercises: [
          { exId: "bulgarian_split_squat", sets: 3, reps: 10 },
          { exId: "rdl", sets: 3, reps: 10 },
          { exId: "step_up", sets: 3, reps: 12 },
          { exId: "hanging_leg_raise", sets: 3, reps: 15 },
          { exId: "side_plank", sets: 3, reps: 30 },
        ],
      },
      {
        label: "Day 4: Push & conditioning",
        exercises: [
          { exId: "ohp", sets: 3, reps: 8 },
          { exId: "dips_chest", sets: 3, reps: 10 },
          { exId: "sled_push", sets: 3, reps: 1 },
          { exId: "russian_twist", sets: 3, reps: 20 },
        ],
      },
    ],
  },
  {
    id: "prog_punisher",
    name: "Berserker",
    tagline: "Raw brute strength — heavy compounds, low reps, no wasted volume",
    weeks: 8,
    days: [
      {
        label: "Day 1: Squat",
        exercises: [
          { exId: "squat", sets: 5, reps: 5 },
          { exId: "front_squat", sets: 3, reps: 5 },
          { exId: "leg_press", sets: 3, reps: 8 },
          { exId: "back_extension", sets: 3, reps: 10 },
        ],
      },
      {
        label: "Day 2: Bench",
        exercises: [
          { exId: "bench", sets: 5, reps: 5 },
          { exId: "close_grip_bench", sets: 3, reps: 6 },
          { exId: "db_bench", sets: 3, reps: 8 },
          { exId: "tricep_pushdown", sets: 3, reps: 10 },
        ],
      },
      {
        label: "Day 3: Deadlift",
        exercises: [
          { exId: "deadlift", sets: 5, reps: 3 },
          { exId: "rack_pull", sets: 3, reps: 5 },
          { exId: "barbell_row", sets: 4, reps: 6 },
          { exId: "farmers_carry", sets: 3, reps: 1 },
        ],
      },
      {
        label: "Day 4: Overhead & accessory",
        exercises: [
          { exId: "ohp", sets: 5, reps: 5 },
          { exId: "pullup", sets: 4, reps: 6 },
          { exId: "barbell_curl", sets: 3, reps: 8 },
          { exId: "skullcrusher", sets: 3, reps: 8 },
        ],
      },
      {
        label: "Day 5: Recovery run",
        exercises: [
          { exId: "run_easy", sets: 1, reps: 30 },
          { exId: "plank", sets: 3, reps: 1 },
        ],
      },
      {
        label: "Day 6: Tempo run + sled drag",
        exercises: [
          { exId: "run_tempo", sets: 1, reps: 20 },
          { exId: "sled_drag_forward", sets: 4, reps: 1 },
          { exId: "sled_drag_backward", sets: 4, reps: 1 },
        ],
      },
      {
        label: "Day 7: Interval sprints",
        exercises: [
          { exId: "run_intervals", sets: 8, reps: 1 },
          { exId: "ab_wheel", sets: 3, reps: 12 },
        ],
      },
    ],
  },
  {
    id: "prog_thor",
    name: "Ragnar",
    tagline: "God-tier mass and power — huge shoulders, back, and grip",
    weeks: 10,
    days: [
      {
        label: "Day 1: Overhead power",
        exercises: [
          { exId: "ohp", sets: 5, reps: 5 },
          { exId: "push_press", sets: 3, reps: 5 },
          { exId: "arsenal_viking_press", sets: 3, reps: 8 },
          { exId: "lat_raise", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 2: Back & grip",
        exercises: [
          { exId: "deadlift", sets: 4, reps: 5 },
          { exId: "barbell_row", sets: 4, reps: 8 },
          { exId: "arsenal_lever_row", sets: 3, reps: 10 },
          { exId: "farmers_carry", sets: 3, reps: 1 },
        ],
      },
      {
        label: "Day 3: Legs & posterior chain",
        exercises: [
          { exId: "squat", sets: 4, reps: 6 },
          { exId: "rdl", sets: 3, reps: 8 },
          { exId: "hip_thrust", sets: 3, reps: 10 },
          { exId: "calf_raise_standing", sets: 4, reps: 15 },
        ],
      },
      {
        label: "Day 4: Strongman conditioning",
        exercises: [
          { exId: "sled_push", sets: 3, reps: 1 },
          { exId: "kb_swing", sets: 4, reps: 15 },
          { exId: "battle_ropes", sets: 3, reps: 30 },
          { exId: "ab_wheel", sets: 3, reps: 12 },
        ],
      },
      {
        label: "Day 5: Arms & traps",
        exercises: [
          { exId: "shrug_barbell", sets: 4, reps: 12 },
          { exId: "barbell_curl", sets: 3, reps: 10 },
          { exId: "skullcrusher", sets: 3, reps: 10 },
          { exId: "hammer_curl", sets: 3, reps: 12 },
        ],
      },
    ],
  },
  {
    id: "prog_firefighter",
    name: "Firefighter",
    tagline: "Job-ready functional strength — work capacity under load",
    weeks: 12,
    days: [
      {
        label: "Day 1: Upper push/pull",
        exercises: [
          { exId: "bench", sets: 4, reps: 8 },
          { exId: "barbell_row", sets: 4, reps: 8 },
          { exId: "ohp", sets: 3, reps: 10 },
          { exId: "pullup", sets: 3, reps: 8 },
        ],
      },
      {
        label: "Day 2: Loaded carries & grip",
        exercises: [
          { exId: "farmers_carry", sets: 4, reps: 1 },
          { exId: "sled_push", sets: 3, reps: 1 },
          { exId: "deadlift", sets: 4, reps: 6 },
          { exId: "wrist_curl", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 3: Legs & work capacity",
        exercises: [
          { exId: "squat", sets: 4, reps: 8 },
          { exId: "leg_press", sets: 3, reps: 12 },
          { exId: "step_up", sets: 3, reps: 12 },
          { exId: "calf_raise_standing", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 4: Conditioning circuit",
        exercises: [
          { exId: "kb_swing", sets: 4, reps: 20 },
          { exId: "battle_ropes", sets: 4, reps: 30 },
          { exId: "sled_drag_forward", sets: 4, reps: 1 },
          { exId: "hanging_leg_raise", sets: 3, reps: 12 },
          { exId: "push_press", sets: 3, reps: 8 },
        ],
      },
      {
        label: "Day 5: Full body functional",
        exercises: [
          { exId: "trap_bar_deadlift", sets: 4, reps: 6 },
          { exId: "single_arm_db_row", sets: 3, reps: 10 },
          { exId: "goblet_squat", sets: 3, reps: 12 },
          { exId: "plank", sets: 3, reps: 1 },
        ],
      },
      {
        label: "Day 6: Run & drag conditioning",
        exercises: [
          { exId: "run_intervals", sets: 6, reps: 1 },
          { exId: "sled_drag_backward", sets: 4, reps: 1 },
          { exId: "stair_climb_intervals", sets: 5, reps: 1 },
          { exId: "farmers_carry", sets: 3, reps: 1 },
        ],
      },
    ],
  },
  {
    id: "prog_hybrid",
    name: "Hybrid",
    tagline: "Strong and has an engine — lifting and conditioning, not one or the other",
    weeks: 10,
    days: [
      {
        label: "Day 1: Strength - upper",
        exercises: [
          { exId: "bench", sets: 4, reps: 8 },
          { exId: "barbell_row", sets: 4, reps: 8 },
          { exId: "ohp", sets: 3, reps: 10 },
          { exId: "lat_pulldown", sets: 3, reps: 10 },
        ],
      },
      {
        label: "Day 2: Conditioning",
        exercises: [
          { exId: "kb_swing", sets: 4, reps: 20 },
          { exId: "battle_ropes", sets: 4, reps: 30 },
          { exId: "sled_push", sets: 4, reps: 1 },
          { exId: "thruster", sets: 3, reps: 12 },
        ],
      },
      {
        label: "Day 3: Strength - lower",
        exercises: [
          { exId: "squat", sets: 4, reps: 8 },
          { exId: "rdl", sets: 3, reps: 10 },
          { exId: "leg_press", sets: 3, reps: 12 },
          { exId: "calf_raise_standing", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 4: Conditioning 2",
        exercises: [
          { exId: "thruster", sets: 4, reps: 12 },
          { exId: "kb_swing", sets: 4, reps: 20 },
          { exId: "battle_ropes", sets: 3, reps: 30 },
          { exId: "hanging_leg_raise", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 5: Strength - full body",
        exercises: [
          { exId: "deadlift", sets: 4, reps: 6 },
          { exId: "pullup", sets: 3, reps: 8 },
          { exId: "db_shoulder_press", sets: 3, reps: 10 },
          { exId: "db_curl", sets: 3, reps: 12 },
        ],
      },
      {
        label: "Day 6: Mobility & recovery",
        exercises: [
          { exId: "goblet_squat", sets: 3, reps: 15 },
          { exId: "ab_wheel", sets: 3, reps: 12 },
          { exId: "face_pull", sets: 3, reps: 15 },
          { exId: "sled_push", sets: 3, reps: 1 },
        ],
      },
    ],
  },
  {
    id: "prog_military",
    name: "Military / First Responder",
    tagline: "Occupational readiness — pass the test, perform on the job",
    weeks: 8,
    days: [
      {
        label: "Day 1: PT test push/pull",
        exercises: [
          { exId: "pushup", sets: 5, reps: 20 },
          { exId: "pullup", sets: 5, reps: 10 },
          { exId: "situp_weighted", sets: 5, reps: 20 },
          { exId: "plank", sets: 3, reps: 1 },
        ],
      },
      {
        label: "Day 2: Load-bearing strength",
        exercises: [
          { exId: "farmers_carry", sets: 4, reps: 1 },
          { exId: "deadlift", sets: 4, reps: 6 },
          { exId: "step_up", sets: 3, reps: 12 },
          { exId: "back_extension", sets: 3, reps: 12 },
        ],
      },
      {
        label: "Day 3: Lower body functional",
        exercises: [
          { exId: "squat", sets: 4, reps: 8 },
          { exId: "walking_lunge", sets: 3, reps: 12 },
          { exId: "leg_press", sets: 3, reps: 12 },
          { exId: "calf_raise_standing", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 4: Conditioning intervals",
        exercises: [
          { exId: "kb_swing", sets: 4, reps: 20 },
          { exId: "battle_ropes", sets: 4, reps: 30 },
          { exId: "sled_drag_forward", sets: 4, reps: 1 },
          { exId: "sled_drag_backward", sets: 4, reps: 1 },
          { exId: "hanging_leg_raise", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 5: Upper body & core",
        exercises: [
          { exId: "bench", sets: 4, reps: 8 },
          { exId: "barbell_row", sets: 4, reps: 8 },
          { exId: "ohp", sets: 3, reps: 10 },
          { exId: "russian_twist", sets: 3, reps: 20 },
        ],
      },
      {
        label: "Day 6: Ruck & sled",
        exercises: [
          { exId: "ruck_march", sets: 1, reps: 1 },
          { exId: "sled_drag_forward", sets: 5, reps: 1 },
          { exId: "sled_push", sets: 4, reps: 1 },
          { exId: "farmers_carry", sets: 3, reps: 1 },
        ],
      },
      {
        label: "Day 7: Run day",
        exercises: [
          { exId: "run_tempo", sets: 1, reps: 25 },
          { exId: "hill_sprints", sets: 6, reps: 1 },
          { exId: "stair_climb_intervals", sets: 5, reps: 1 },
        ],
      },
    ],
  },
  {
    id: "prog_valkyrie",
    name: "Valkyrie",
    tagline: "Glutes, hips, and hamstrings lead every week — lower body hypertrophy with just enough upper body to stay balanced",
    weeks: 10,
    days: [
      {
        label: "Day 1: Glutes & hamstrings",
        exercises: [
          { exId: "rdl", sets: 4, reps: 8 },
          { exId: "hip_thrust", sets: 4, reps: 10 },
          { exId: "bulgarian_split_squat", sets: 3, reps: 10 },
          { exId: "leg_curl_seated", sets: 3, reps: 12 },
          { exId: "cable_pull_through", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 2: Upper body push/pull",
        exercises: [
          { exId: "db_bench", sets: 3, reps: 10 },
          { exId: "seated_row", sets: 3, reps: 10 },
          { exId: "db_shoulder_press", sets: 3, reps: 12 },
          { exId: "lat_pulldown", sets: 3, reps: 12 },
          { exId: "tricep_pushdown", sets: 3, reps: 12 },
        ],
      },
      {
        label: "Day 3: Glutes & quads",
        exercises: [
          { exId: "squat", sets: 4, reps: 8 },
          { exId: "walking_lunge", sets: 3, reps: 12 },
          { exId: "hip_thrust_machine", sets: 3, reps: 12 },
          { exId: "leg_extension", sets: 3, reps: 15 },
          { exId: "hip_abduction_machine", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 4: Shoulders & arms",
        exercises: [
          { exId: "lat_raise", sets: 3, reps: 15 },
          { exId: "hammer_curl", sets: 3, reps: 12 },
          { exId: "overhead_tricep_ext", sets: 3, reps: 12 },
          { exId: "rear_delt_fly", sets: 3, reps: 15 },
          { exId: "face_pull", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 5: Glute burnout & core",
        exercises: [
          { exId: "hip_thrust", sets: 4, reps: 12 },
          { exId: "glute_kickback_machine", sets: 3, reps: 15 },
          { exId: "hip_adduction_machine", sets: 3, reps: 15 },
          { exId: "step_up", sets: 3, reps: 12 },
          { exId: "hanging_leg_raise", sets: 3, reps: 15 },
        ],
      },
    ],
  },
  {
    id: "prog_huntress",
    name: "Huntress",
    tagline: "Full-body strength with a lean, athletic finish — higher reps, real conditioning, no wasted days",
    weeks: 8,
    days: [
      {
        label: "Day 1: Full body strength A",
        exercises: [
          { exId: "squat", sets: 3, reps: 10 },
          { exId: "db_bench", sets: 3, reps: 10 },
          { exId: "seated_row", sets: 3, reps: 10 },
          { exId: "rdl", sets: 3, reps: 10 },
          { exId: "plank", sets: 3, reps: 1 },
        ],
      },
      {
        label: "Day 2: Conditioning & core",
        exercises: [
          { exId: "kb_swing", sets: 4, reps: 15 },
          { exId: "battle_ropes", sets: 4, reps: 30 },
          { exId: "hanging_leg_raise", sets: 3, reps: 12 },
          { exId: "russian_twist", sets: 3, reps: 20 },
        ],
      },
      {
        label: "Day 3: Full body strength B",
        exercises: [
          { exId: "deadlift", sets: 3, reps: 8 },
          { exId: "ohp", sets: 3, reps: 10 },
          { exId: "lat_pulldown", sets: 3, reps: 10 },
          { exId: "walking_lunge", sets: 3, reps: 12 },
          { exId: "cable_crunch", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 4: Glutes & arms finisher",
        exercises: [
          { exId: "hip_thrust", sets: 4, reps: 12 },
          { exId: "leg_curl_seated", sets: 3, reps: 12 },
          { exId: "db_curl", sets: 3, reps: 12 },
          { exId: "tricep_pushdown", sets: 3, reps: 12 },
          { exId: "lat_raise", sets: 3, reps: 15 },
        ],
      },
    ],
  },
];

// Defaults for the auto-started rest timer, keyed by movement category. Compound lifts get
// the longest rest, isolation/conditioning/superset work progressively less — overridable
// per-category in Settings.
const DEFAULT_REST_DEFAULTS = { compound: 150, isolation: 90, conditioning: 60, superset: 45 };

function loadInitialState() {
  return {
    templates: DEFAULT_TEMPLATES,
    programs: HERO_PROGRAMS,
    customPlans: [],
    customPrograms: [], // { id, name, tagline, days: [{ label, exercises }] }
    customExercises: [], // { id, name, type, muscle }
    logs: [], // { id, exId, date, sets: [{weight, reps, drops?, setType?, rir?, rpe?}], targetReps }
    cardioLogs: [], // { id, exId, date, distance, distanceUnit, duration, load, notes }
    currentProgram: null, // { programId, programName, source: "builtin" | "custom", dayIndex, totalDays, startDate }
    photos: [], // { id, date, context, dataUrl }
    completedPrograms: [], // { id, programId, programSource, programName, weeks, startDate, endDate }
    hasSeenOnboarding: false, // sticky — never re-derived from current data, only set true by a real action
    settings: {
      rirSystem: "rir", // "rir" | "rpe"
      restDefaults: DEFAULT_REST_DEFAULTS,
      barWeight: 45,
    },
    exerciseNotes: {}, // { [exId]: { general, machine, cue } }
    workoutSessions: [], // finished guided-run summaries — see buildSessionSummary()
    goals: [], // { id, title, type, startValue, currentValue, targetValue, targetDate, units,
    // priority: "primary"|"secondary", notes, status: "active"|"paused"|"completed",
    // linkedExId?, metric?, history?, createdAt } — see src/utils/goalMath.js, goalData.js
    bodyweightLogs: [], // { id, date, weight, waist, bodyFat, notes }
    readinessLogs: [], // { id, date, sleepQuality, sleepHours, soreness, stress, motivation, energy, restingHR, notes }
    coachHistory: [], // { id, date, type: "morning_checkin"|"pre_workout"|"post_workout"|"weekly_review"|"question", question?, message }
  };
}

// Programs renamed after users may already have saved plan copies / a currentProgram
// referencing the old names — brings those forward so nothing's left pointing at a name
// that no longer exists anywhere in the app.
const RENAMED_PROGRAMS = { Superman: "Titan", Batman: "Reaper", Punisher: "Berserker", Thor: "Ragnar" };

function migrateProgramNames(state) {
  const customPlans = (state.customPlans || []).map((p) => {
    const sepIdx = p.name.indexOf(" — ");
    if (sepIdx === -1) return p;
    const prefix = p.name.slice(0, sepIdx);
    const rest = p.name.slice(sepIdx);
    return RENAMED_PROGRAMS[prefix] ? { ...p, name: RENAMED_PROGRAMS[prefix] + rest } : p;
  });

  const customPrograms = (state.customPrograms || []).map((p) =>
    RENAMED_PROGRAMS[p.name] ? { ...p, name: RENAMED_PROGRAMS[p.name] } : p
  );

  const currentProgram =
    state.currentProgram && RENAMED_PROGRAMS[state.currentProgram.programName]
      ? { ...state.currentProgram, programName: RENAMED_PROGRAMS[state.currentProgram.programName] }
      : state.currentProgram;

  return { ...state, customPlans, customPrograms, currentProgram };
}

// ---------- Data export / import ----------
// Everything the user has actually created — not the built-in templates/programs, which
// ship with the app and always come from source, never from a backup file.
const BACKUP_DATA_KEYS = [
  "logs",
  "cardioLogs",
  "customExercises",
  "customPlans",
  "customPrograms",
  "currentProgram",
  "photos",
  "completedPrograms",
  "settings",
  "exerciseNotes",
  "workoutSessions",
  "goals",
  "bodyweightLogs",
  "readinessLogs",
  "coachHistory",
];

// Per-key fallback when a key is missing from state entirely (older saves) — objects default
// to {}, currentProgram to null, everything else (arrays) to [].
function backupKeyDefault(key) {
  if (key === "currentProgram") return null;
  if (key === "settings" || key === "exerciseNotes") return {};
  return [];
}

function exportBackupFile(state) {
  const payload = {
    app: "BRK - Lift",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data: Object.fromEntries(BACKUP_DATA_KEYS.map((k) => [k, state[k] ?? backupKeyDefault(k)])),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `brk-lift-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Returns { ok: true, data } or { ok: false, error }. Never throws.
function parseBackupFile(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  const data = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed.data || parsed : null;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "That file doesn't look like a BRK - Lift backup." };
  }
  const hasKnownKey = BACKUP_DATA_KEYS.some((k) => k in data);
  if (!hasKnownKey) {
    return { ok: false, error: "That file doesn't contain any recognizable BRK - Lift data." };
  }
  return { ok: true, data };
}

// ---------- Set type classification ----------
// "working" is the implicit default — a set with no setType at all (every set logged before
// this feature existed, plus any new set that's never had its chip tapped) is treated as a
// normal working set everywhere below.
const SET_TYPES = [
  { value: "working", label: "Working", short: "WK" },
  { value: "warmup", label: "Warm-up", short: "W" },
  { value: "top", label: "Top set", short: "TOP" },
  { value: "backoff", label: "Back-off", short: "BO" },
  { value: "dropset", label: "Drop set", short: "DS" },
  { value: "failure", label: "Failure", short: "F" },
  { value: "amrap", label: "AMRAP", short: "AMRAP" },
];
function isWarmup(s) {
  return s.setType === "warmup";
}
// Warm-ups never distort PRs, volume, or progression math — this is the one filter every
// analytics/progression helper below runs sets through first.
function countedSets(sets) {
  return sets.filter((s) => !isWarmup(s));
}

// ---------- Dropset / RIR-RPE formatting helpers ----------
// A set is { weight, reps, drops?: [{ weight, reps }, ...], setType?, rir?, rpe? }. drops,
// setType, rir, rpe are only present when they carry a non-default value.
function formatSetCompact(s) {
  const parts = [`${s.weight}x${s.reps}`, ...(s.drops || []).map((d) => `${d.weight}x${d.reps}`)];
  return parts.join(" → ");
}
function rirRpeSuffix(s) {
  if (s.rir != null) return ` @${s.rir} RIR`;
  if (s.rpe != null) return ` @RPE ${s.rpe}`;
  return "";
}
function formatSetVerbose(s) {
  const parts = [
    `${s.weight} lb x ${s.reps} reps${rirRpeSuffix(s)}`,
    ...(s.drops || []).map((d) => `${d.weight} lb x ${d.reps} reps`),
  ];
  return parts.join(" → ");
}
function formatSetsVerbose(sets) {
  return sets.map(formatSetVerbose).join(", ");
}

// Turns the raw editor rows (string inputs, possibly-empty drop rows) into the clean shape
// saved to state.logs. A set is dropped entirely if its own weight/reps are blank; an
// individual blank drop row is dropped without affecting the rest. drops/setType/rir/rpe are
// omitted from the result whenever they'd carry only a default/empty value, keeping old and
// new saved entries structurally identical wherever nothing new was actually used.
function cleanSetsInput(sets) {
  return sets
    .filter((s) => s.weight !== "" && s.reps !== "")
    .map((s) => {
      const cleanDrops = (s.drops || [])
        .filter((d) => d.weight !== "" && d.reps !== "")
        .map((d) => ({ weight: Number(d.weight), reps: Number(d.reps) }));
      return {
        weight: Number(s.weight),
        reps: Number(s.reps),
        ...(cleanDrops.length > 0 ? { drops: cleanDrops } : {}),
        ...(s.setType && s.setType !== "working" ? { setType: s.setType } : {}),
        ...(s.rir !== "" && s.rir != null ? { rir: Number(s.rir) } : {}),
        ...(s.rpe !== "" && s.rpe != null ? { rpe: Number(s.rpe) } : {}),
      };
    });
}

// ---------- PR detection ----------
// Epley formula — the standard, simple estimated-1RM approximation. Not exact, never claimed
// to be; just a consistent basis for comparing effort across different rep ranges.
function estimateOneRM(weight, reps) {
  return weight * (1 + reps / 30);
}
// Sum of weight*reps across a counted set's main reps plus any drops — drops are real reps at
// real weight, so they count toward volume even though they're ignored for suggestNext/PRs
// that are specifically about the top working weight.
function setVolume(s) {
  const dropVolume = (s.drops || []).reduce((sum, d) => sum + d.weight * d.reps, 0);
  return s.weight * s.reps + dropVolume;
}
function entryVolume(entry) {
  return countedSets(entry.sets).reduce((sum, s) => sum + setVolume(s), 0);
}

// Compares a freshly-saved entry against every prior log for the same exercise (priorLogs
// must NOT include the new entry itself) and reports which PR categories it broke. Returns
// [] for an exercise's very first-ever log — there's no baseline yet to call a "record."
function detectPRs(exId, newEntry, priorLogs) {
  const priorForEx = priorLogs.filter((l) => l.exId === exId);
  const newCounted = countedSets(newEntry.sets);
  if (priorForEx.length === 0 || newCounted.length === 0) return [];

  const priorCountedSets = priorForEx.flatMap((l) => countedSets(l.sets));
  const prevMaxWeight = Math.max(0, ...priorCountedSets.map((s) => s.weight));
  const prevMaxE1RM = Math.max(0, ...priorCountedSets.map((s) => estimateOneRM(s.weight, s.reps)));
  const prevMaxVolume = Math.max(0, ...priorForEx.map(entryVolume));
  // Best reps ever previously done at a weight >= this one, so a rep PR only counts against
  // an equal-or-harder load, never an easier one.
  const prevBestRepsAtWeight = (weight) =>
    Math.max(0, ...priorCountedSets.filter((s) => s.weight >= weight).map((s) => s.reps));

  const prs = [];
  const heaviestSet = newCounted.reduce((best, s) => (s.weight > best.weight ? s : best), newCounted[0]);
  if (heaviestSet.weight > prevMaxWeight) {
    prs.push({ type: "weight", weight: heaviestSet.weight, reps: heaviestSet.reps, prev: prevMaxWeight });
  }
  const repPrSet = newCounted.find((s) => s.reps > prevBestRepsAtWeight(s.weight));
  if (repPrSet) {
    prs.push({ type: "reps", weight: repPrSet.weight, reps: repPrSet.reps, prev: prevBestRepsAtWeight(repPrSet.weight) });
  }
  const bestE1RMSet = newCounted.reduce(
    (best, s) => (estimateOneRM(s.weight, s.reps) > estimateOneRM(best.weight, best.reps) ? s : best),
    newCounted[0]
  );
  const newE1RM = estimateOneRM(bestE1RMSet.weight, bestE1RMSet.reps);
  if (newE1RM > prevMaxE1RM) {
    prs.push({
      type: "e1rm",
      weight: bestE1RMSet.weight,
      reps: bestE1RMSet.reps,
      value: Math.round(newE1RM),
      prev: Math.round(prevMaxE1RM),
    });
  }
  const newVolume = entryVolume(newEntry);
  if (newVolume > prevMaxVolume) {
    prs.push({ type: "exerciseVolume", value: Math.round(newVolume), prev: Math.round(prevMaxVolume) });
  }
  return prs;
}

// ---------- Plate calculator ----------
const PLATE_SIZES = [45, 35, 25, 10, 5, 2.5];
// Greedy fill — correct for a standard plate set since every denomination divides evenly
// into the next one up. Returns the plates needed per side plus any leftover that can't be
// made exactly (only possible with an unusual custom bar/target combo).
function platesPerSide(targetWeight, barWeight) {
  let remaining = (targetWeight - barWeight) / 2;
  if (remaining <= 0) return { plates: [], remainder: 0 };
  const plates = [];
  for (const size of PLATE_SIZES) {
    while (remaining >= size - 0.001) {
      plates.push(size);
      remaining -= size;
    }
  }
  return { plates, remainder: Math.round(remaining * 100) / 100 };
}

// ---------- Post-workout summary ----------
// Builds the record saved to state.workoutSessions when a guided run is finished. priorLogs
// should be state.logs *excluding* this session's own entries (they're already in state.logs
// by the time this runs) so PR detection compares against what came before the session, not
// against itself.
function buildSessionSummary(run, allLogs, priorSessions, exMap) {
  const finishedAt = new Date();
  const startedAt = run.startedAt ? new Date(run.startedAt) : finishedAt;
  const durationSec = Math.max(0, Math.round((finishedAt - startedAt) / 1000));
  const entries = run.sessionEntries.map((se) => se.entry);
  const entryIds = new Set(entries.map((e) => e.id));
  const priorLogs = allLogs.filter((l) => !entryIds.has(l.id));

  let workingSets = 0;
  let totalReps = 0;
  let totalVolume = 0;
  const rirValues = [];
  const muscleCounts = {};
  const prs = [];

  entries.forEach((entry) => {
    const counted = countedSets(entry.sets);
    workingSets += counted.length;
    counted.forEach((s) => {
      totalReps += s.reps + (s.drops || []).reduce((sum, d) => sum + d.reps, 0);
      if (s.rir != null) rirValues.push(s.rir);
      else if (s.rpe != null) rirValues.push(10 - s.rpe);
    });
    totalVolume += entryVolume(entry);
    const muscle = exMap[entry.exId]?.muscle;
    if (muscle) muscleCounts[muscle] = (muscleCounts[muscle] || 0) + 1;
    detectPRs(entry.exId, entry, priorLogs).forEach((pr) => prs.push({ ...pr, exId: entry.exId }));
  });

  const avgRir = rirValues.length > 0 ? rirValues.reduce((s, v) => s + v, 0) / rirValues.length : null;
  const mainMuscles = Object.entries(muscleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m]) => m);

  const prevSameFn = priorSessions
    .filter((s) => s.planName === run.planName)
    .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));
  const prevSame = prevSameFn[0] || null;
  const perfDeltaPct =
    prevSame && prevSame.totalVolume > 0 ? Math.round(((totalVolume - prevSame.totalVolume) / prevSame.totalVolume) * 1000) / 10 : null;

  const prevMaxSessionVolume = Math.max(0, ...priorSessions.map((s) => s.totalVolume || 0));
  const isVolumePR = priorSessions.length > 0 && totalVolume > prevMaxSessionVolume;

  // "Best lift" for the headline — prefer an actual weight/e1RM PR; fall back to the single
  // best e1RM set of the session when nothing broke a record.
  let bestLift = null;
  const headlinePR = prs.find((p) => p.type === "weight") || prs.find((p) => p.type === "e1rm");
  if (headlinePR) {
    bestLift = { exId: headlinePR.exId, weight: headlinePR.weight, reps: headlinePR.reps };
  } else {
    let best = null;
    entries.forEach((entry) => {
      countedSets(entry.sets).forEach((s) => {
        const e1rm = estimateOneRM(s.weight, s.reps);
        if (!best || e1rm > best.e1rm) best = { exId: entry.exId, weight: s.weight, reps: s.reps, e1rm };
      });
    });
    bestLift = best;
  }

  return {
    id: `session_${Date.now()}`,
    planName: run.planName,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationSec,
    exerciseCount: entries.length,
    workingSets,
    totalReps,
    totalVolume: Math.round(totalVolume),
    prs,
    isVolumePR,
    mainMuscles,
    avgRir: avgRir != null ? Math.round(avgRir * 10) / 10 : null,
    perfDeltaPct,
    bestLift,
    rating: null,
  };
}

function formatSessionDuration(totalSeconds) {
  const mins = Math.round(totalSeconds / 60);
  return mins < 1 ? "<1 min" : `${mins} min`;
}

function usageCounts(logs) {
  const counts = {};
  logs.forEach((l) => {
    counts[l.exId] = (counts[l.exId] || 0) + 1;
  });
  return counts;
}

// ---------- Cardio helpers ----------
function formatPace(minutesPerUnit) {
  if (!minutesPerUnit || !isFinite(minutesPerUnit)) return null;
  const mins = Math.floor(minutesPerUnit);
  const secs = Math.round((minutesPerUnit - mins) * 60);
  const secsPadded = secs < 10 ? `0${secs}` : `${secs}`;
  return `${mins}:${secsPadded}`;
}

function cardioPace(entry) {
  if (entry.distanceUnit !== "mi" || !entry.distance || !entry.duration) return null;
  return entry.duration / entry.distance;
}

function bestCardioStat(exId, cardioLogs) {
  const entries = cardioLogs.filter((l) => l.exId === exId);
  if (entries.length === 0) return null;
  const withPace = entries.map((e) => ({ ...e, pace: cardioPace(e) })).filter((e) => e.pace !== null);
  if (withPace.length > 0) {
    const best = withPace.reduce((a, b) => (b.pace < a.pace ? b : a));
    return { type: "pace", value: formatPace(best.pace), date: best.date };
  }
  const withDistance = entries.filter((e) => e.distance);
  if (withDistance.length > 0) {
    const best = withDistance.reduce((a, b) => (b.distance > a.distance ? b : a));
    return { type: "distance", value: `${best.distance} ${best.distanceUnit || ""}`.trim(), date: best.date };
  }
  return null;
}

// The main nav is deliberately just these four — everything else (mission detail, cardio,
// templates, build, catalog, top used, photos, settings, coach) is still its own screen with
// its own `tab` id, just reached by tapping into it from one of these four instead of having
// a permanent slot in the bar. SECTION_OF is only for highlighting which of the four is
// "closest" to wherever the user actually is; it doesn't gate access to anything.
const TOP_TABS = [
  { id: "today", label: "Today", icon: Home },
  { id: "train", label: "Train", icon: Dumbbell },
  { id: "progress", label: "Progress", icon: Scale },
  { id: "more", label: "More", icon: MoreHorizontal },
];
const SECTION_OF = {
  today: "today",
  mission: "today",
  coach: "today",
  train: "train",
  log: "train",
  cardio: "train",
  templates: "train",
  build: "train",
  progress: "progress",
  photos: "progress",
  more: "more",
  catalog: "more",
  top: "more",
  settings: "more",
};

export default function LiftLog() {
  const [state, setState] = useState(loadInitialState());
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("today");
  // Lazy-initted straight from localStorage (not loaded in an effect like `state` below) so
  // an in-progress workout is already in place on the very first render — no flash back to
  // the plan-picker tab, and no race with the persist effect right below.
  const [activeRun, setActiveRun] = useState(() => {
    try {
      const raw = window.localStorage.getItem("liftlog-active-run");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });
  // Keeps the in-progress (or just-finished-but-not-yet-exited) run surviving a closed tab,
  // backgrounded phone, or crash — otherwise closing mid-workout silently drops everything
  // that wasn't already saved as a logged set. Cleared once the user actually exits the run
  // (finishRun -> "Back to plans", or Exit), not merely on "Finish workout".
  useEffect(() => {
    try {
      if (activeRun) window.localStorage.setItem("liftlog-active-run", JSON.stringify(activeRun));
      else window.localStorage.removeItem("liftlog-active-run");
    } catch (e) {
      // storage unavailable
    }
  }, [activeRun]);
  const [restBump, setRestBump] = useState({ token: 0, seconds: 90 });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("liftlog-data");
      if (raw) {
        const parsed = JSON.parse(raw);
        setState((s) => {
          // templates/programs are static, app-shipped content — always take the fresh
          // in-source copy, never whatever got persisted from an older build. Older saves
          // (from before persist() excluded them) can still carry a stale copy forward
          // through this spread otherwise, silently reverting any future edit to the
          // built-in library — which is exactly what happened with this rename.
          const merged = { ...s, ...parsed, templates: DEFAULT_TEMPLATES, programs: HERO_PROGRAMS };
          let migrated = migrateProgramNames(merged);
          // Backward-compat: a returning user whose save predates the onboarding flag
          // already clearly isn't a fresh install — retroactively mark them as having
          // seen it so they never see the welcome screen. A brand-new install has no
          // `raw` at all, so this block never runs for them and the loadInitialState()
          // default (false) correctly stands.
          if (!migrated.hasSeenOnboarding) {
            const alreadyActive =
              (migrated.logs || []).length > 0 || (migrated.cardioLogs || []).length > 0 || !!migrated.currentProgram;
            if (alreadyActive) migrated = { ...migrated, hasSeenOnboarding: true };
          }
          try {
            const { templates, programs, ...toPersist } = migrated;
            window.localStorage.setItem("liftlog-data", JSON.stringify(toPersist));
          } catch (e) {
            // storage unavailable — migrated state still applies for this session
          }
          return migrated;
        });
      }
    } catch (e) {
      // no saved data yet, or storage unavailable
    } finally {
      setLoaded(true);
    }
  }, []);

  const persist = useCallback((next) => {
    try {
      // Never persist templates/programs — they're static app content that should
      // always come from source on the next load, not a snapshot from whatever build
      // last saved.
      const { templates, programs, ...toPersist } = next;
      window.localStorage.setItem("liftlog-data", JSON.stringify(toPersist));
    } catch (e) {
      console.error("Storage error", e);
    }
  }, []);

  const updateState = useCallback(
    (updater) => {
      setState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const allExercises = useMemo(
    () => [...EXERCISE_LIBRARY, ...(state.customExercises || [])],
    [state.customExercises]
  );
  const exMap = useMemo(
    () => ({ ...EX_MAP_INIT, ...Object.fromEntries((state.customExercises || []).map((e) => [e.id, e])) }),
    [state.customExercises]
  );

  // Picks the right rest duration for whatever just got logged and (re)starts the global
  // timer at it. Accepts a logged entry (category derived from its exercise's compound/
  // isolation type), or a plain category string directly (e.g. CardioTab passes
  // "conditioning" — there's no exMap lookup for a run/row).
  const bumpRestTimer = useCallback(
    (arg) => {
      const defaults = { ...DEFAULT_REST_DEFAULTS, ...(state.settings?.restDefaults || {}) };
      let category = "compound";
      if (typeof arg === "string" && defaults[arg] != null) category = arg;
      else if (arg && typeof arg === "object" && arg.exId) category = exMap[arg.exId]?.type === "isolation" ? "isolation" : "compound";
      const seconds = defaults[category] ?? defaults.compound;
      setRestBump((prev) => ({ token: prev.token + 1, seconds }));
    },
    [state.settings, exMap]
  );

  const startRun = (plan, fromTab, programContext) => {
    setActiveRun({
      planName: plan.name,
      exercises: plan.exercises,
      sessionEntries: [],
      swaps: {},
      finished: false,
      returnTab: fromTab,
      programContext: programContext || null,
      startedAt: new Date().toISOString(),
    });
    if (programContext) {
      updateState((prev) => {
        const isSameProgram =
          prev.currentProgram &&
          prev.currentProgram.programId === programContext.programId &&
          prev.currentProgram.source === programContext.source;
        const startDate = isSameProgram ? prev.currentProgram.startDate : new Date().toISOString();
        return { ...prev, currentProgram: { ...programContext, startDate }, hasSeenOnboarding: true };
      });
    }
  };
  const recordRunEntry = (index, entry) => {
    setActiveRun((run) => ({ ...run, sessionEntries: [...run.sessionEntries, { index, exId: entry.exId, entry }] }));
  };
  // Used when a collapsed "Logged this session" card is edited/deleted via the shared
  // EditLogEntryPanel — keeps the run's own tracking of which slot is logged in sync with
  // state.logs, since that's what determines which card collapses vs. stays active.
  const editRunEntry = (index, updatedEntry) => {
    setActiveRun((run) => ({
      ...run,
      sessionEntries: run.sessionEntries.map((se) => (se.index === index ? { ...se, entry: updatedEntry } : se)),
    }));
  };
  const deleteRunEntry = (index) => {
    setActiveRun((run) => ({ ...run, sessionEntries: run.sessionEntries.filter((se) => se.index !== index) }));
  };
  const swapRunExercise = (index, newExId) => {
    setActiveRun((run) => ({ ...run, swaps: { ...(run.swaps || {}), [index]: newExId } }));
  };
  const finishRun = () => {
    const summary = buildSessionSummary(activeRun, state.logs, state.workoutSessions || [], exMap);
    // Only worth a coach review when something was actually logged — an empty session has
    // nothing to grade.
    const coachMessage = summary.exerciseCount > 0 ? generatePostWorkoutReview(summary).message : null;
    const summaryWithCoach = coachMessage ? { ...summary, coachMessage } : summary;
    updateState((prev) => ({
      ...prev,
      workoutSessions: [summaryWithCoach, ...(prev.workoutSessions || [])],
      ...(coachMessage
        ? {
            coachHistory: [
              { id: `coach_${Date.now()}`, date: new Date().toISOString(), type: "post_workout", message: coachMessage },
              ...(prev.coachHistory || []),
            ],
          }
        : {}),
    }));
    setActiveRun((run) => ({ ...run, finished: true, summaryId: summary.id }));
    if (activeRun?.programContext) {
      const ctx = activeRun.programContext;
      updateState((prev) => ({
        ...prev,
        currentProgram: {
          ...ctx,
          dayIndex: (ctx.dayIndex + 1) % ctx.totalDays,
          startDate: prev.currentProgram?.startDate || new Date().toISOString(),
        },
      }));
    }
  };
  const exitRun = () => {
    setTab(activeRun?.returnTab || "templates");
    setActiveRun(null);
  };
  const rateSession = (sessionId, rating) => {
    updateState((prev) => ({
      ...prev,
      workoutSessions: (prev.workoutSessions || []).map((s) => (s.id === sessionId ? { ...s, rating } : s)),
    }));
  };
  const restartCurrentProgram = () => {
    updateState((prev) =>
      prev.currentProgram
        ? { ...prev, currentProgram: { ...prev.currentProgram, dayIndex: 0, startDate: new Date().toISOString() } }
        : prev
    );
  };
  // Used by the completed-programs history list to relaunch a program that's no longer
  // "current" (its currentProgram was cleared when the user moved on).
  const restartProgramById = (programId, source) => {
    const list = source === "custom" ? state.customPrograms || [] : state.programs || [];
    const prog = list.find((p) => p.id === programId);
    if (!prog) return;
    updateState((prev) => ({
      ...prev,
      currentProgram: {
        programId: prog.id,
        programName: prog.name,
        source,
        dayIndex: 0,
        totalDays: prog.days.length,
        startDate: new Date().toISOString(),
      },
    }));
    setTab("log");
  };
  const goToTemplatesAndClearProgram = () => {
    updateState((prev) => ({ ...prev, currentProgram: null }));
    setTab("templates");
  };

  // Records a program's completion to history once (deduped by programId+startDate, the
  // unique identifier for a given run-through) as soon as it's detected — independent of
  // whether the "Program complete" banner is currently on screen. Doesn't clear
  // currentProgram itself; that only happens when the user picks Restart or New program,
  // so the banner (and its actions) stays usable however long they take to respond.
  useEffect(() => {
    const resolved = resolveCurrentProgramDay(state);
    if (!resolved?.isComplete) return;
    const cp = state.currentProgram;
    const alreadyRecorded = (state.completedPrograms || []).some(
      (c) => c.programId === cp.programId && c.startDate === cp.startDate
    );
    if (alreadyRecorded) return;
    const entry = {
      id: `completed_${Date.now()}`,
      programId: cp.programId,
      programSource: cp.source,
      programName: resolved.programName,
      weeks: resolved.totalWeeks,
      startDate: cp.startDate,
      endDate: new Date().toISOString(),
    };
    updateState((prev) => {
      if (!prev.currentProgram || prev.currentProgram.programId !== cp.programId || prev.currentProgram.startDate !== cp.startDate) {
        return prev;
      }
      const dup = (prev.completedPrograms || []).some((c) => c.programId === cp.programId && c.startDate === cp.startDate);
      if (dup) return prev;
      return { ...prev, completedPrograms: [entry, ...(prev.completedPrograms || [])] };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!loaded) {
    return (
      <div className="w-full min-h-[400px] flex items-center justify-center bg-charcoal-deep text-neutral-400 text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="w-full bg-charcoal-deep text-neutral-200 font-sans min-h-[600px]">
      <Header />
      <RestTimer bump={restBump} />
      <div className={`p-4 sm:p-6 ${!activeRun ? "pb-24" : ""}`}>
        {activeRun ? (
          <GuidedRunView
            run={activeRun}
            state={state}
            updateState={updateState}
            exMap={exMap}
            allExercises={allExercises}
            onSaved={recordRunEntry}
            onEditEntry={editRunEntry}
            onDeleteEntry={deleteRunEntry}
            onFinish={finishRun}
            onExit={exitRun}
            onSwap={swapRunExercise}
            onLoggedSet={bumpRestTimer}
            onRate={rateSession}
            onAskCoach={() => {
              exitRun();
              setTab("coach");
            }}
          />
        ) : (
          <>
            {tab === "today" &&
              (!state.hasSeenOnboarding ? (
                <OnboardingView
                  state={state}
                  onStartRun={(plan, programContext) => startRun(plan, "today", programContext)}
                  onGoToTemplates={() => setTab("templates")}
                />
              ) : (
                <TodayTab
                  state={state}
                  updateState={updateState}
                  exMap={exMap}
                  allExercises={allExercises}
                  activeRun={activeRun}
                  onStartRun={(plan, programContext) => startRun(plan, "today", programContext)}
                  onNavigate={setTab}
                />
              ))}
            {tab === "train" && <TrainTab state={state} onStartRun={(plan, programContext) => startRun(plan, "train", programContext)} onNavigate={setTab} />}
            {tab === "more" && <MoreTab state={state} updateState={updateState} onNavigate={setTab} />}
            {tab === "log" && (
              <LogTab
                state={state}
                updateState={updateState}
                allExercises={allExercises}
                exMap={exMap}
                onStartRun={(plan, programContext) => startRun(plan, "log", programContext)}
                onLoggedSet={bumpRestTimer}
                onRestartProgram={restartCurrentProgram}
                onGoToTemplates={goToTemplatesAndClearProgram}
              />
            )}
            {tab === "mission" && <MissionTab state={state} updateState={updateState} allExercises={allExercises} exMap={exMap} />}
            {tab === "coach" && <CoachTab state={state} updateState={updateState} exMap={exMap} />}
            {tab === "cardio" && (
              <CardioTab
                state={state}
                updateState={updateState}
                allExercises={allExercises}
                exMap={exMap}
                onLoggedSet={bumpRestTimer}
              />
            )}
            {tab === "progress" && <ProgressTab state={state} updateState={updateState} allExercises={allExercises} exMap={exMap} onNavigate={setTab} />}
            {tab === "templates" && (
              <TemplatesTab
                state={state}
                updateState={updateState}
                exMap={exMap}
                onStartRun={(plan, programContext) => startRun(plan, "templates", programContext)}
                onRestartCompletedProgram={restartProgramById}
                onGoToBuild={() => setTab("build")}
              />
            )}
            {tab === "build" && (
              <BuildPlanTab
                state={state}
                updateState={updateState}
                allExercises={allExercises}
                exMap={exMap}
                onStartRun={(plan, programContext) => startRun(plan, "build", programContext)}
                onGoToPlans={() => setTab("templates")}
              />
            )}
            {tab === "catalog" && <CatalogTab state={state} updateState={updateState} allExercises={allExercises} />}
            {tab === "top" && <TopUsedTab state={state} exMap={exMap} />}
            {tab === "photos" && <PhotosTab state={state} updateState={updateState} />}
            {tab === "settings" && <SettingsTab state={state} updateState={updateState} />}
          </>
        )}
      </div>

      {!activeRun && (
        <div className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-red-900/40 bg-charcoal-panel">
          {TOP_TABS.map((t) => {
            const active = (SECTION_OF[tab] || tab) === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] uppercase tracking-widest transition-colors ${
                  active ? "text-red-500" : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                <t.icon size={20} />
                {t.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <div className="px-4 sm:px-6 pt-6 pb-4 border-b border-red-900/40 bg-gradient-to-b from-charcoal-panel to-charcoal-deep">
      <div className="flex items-center gap-3">
        <img
          src={BREAK_LOGO}
          alt="B.R.E.A.K. logo"
          className="w-11 h-11 rounded-full object-cover ring-1 ring-red-700/60"
        />
        <div>
          <div className="text-white font-bold tracking-wider text-sm leading-none">BRK - LIFT</div>
          <div className="text-[10px] text-neutral-500 tracking-widest uppercase mt-1">Keep the promises you make to yourself</div>
        </div>
      </div>
    </div>
  );
}

// ---------------- SHARED SLIDE-IN DRILL-DOWN PANEL ----------------
// Full-width view that slides in from the right with a back arrow at the top, replacing
// an accordion-expand or a dead-end tap. Used for Templates/My plans drill-down and the
// exercise swap picker.

// ---------------- EXERCISE SWAP PICKER ----------------
// Filtered to the same muscle group as the exercise being swapped, with a search bar
// (same pattern as the catalog search elsewhere) to widen it if needed.
function ExerciseSwapPicker({ currentExId, allExercises, exMap, onBack, onSelect }) {
  const [query, setQuery] = useState("");
  const currentMuscle = exMap[currentExId]?.muscle;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? allExercises.filter((ex) => ex.name.toLowerCase().includes(q) || ex.muscle.toLowerCase().includes(q))
      : allExercises.filter((ex) => ex.muscle === currentMuscle);
    return pool.filter((ex) => ex.id !== currentExId);
  }, [query, allExercises, currentMuscle, currentExId]);

  return (
    <SlideInPanel
      title="Swap exercise"
      subtitle={currentMuscle ? `Same muscle group: ${currentMuscle} — this session only` : "This session only"}
      onBack={onBack}
    >
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search the catalog..."
        className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-xs focus:outline-none focus:border-red-700"
      />
      <div className="space-y-1.5">
        {results.map((ex) => (
          <button
            key={ex.id}
            onClick={() => onSelect(ex.id)}
            className="w-full text-left px-3 py-2 text-sm border border-neutral-900 text-neutral-300 hover:border-red-700 hover:text-white"
          >
            {ex.name}
            <span className="text-xs text-neutral-600 ml-2">{ex.muscle}</span>
          </button>
        ))}
        {results.length === 0 && (
          <div className="text-xs text-neutral-600 py-4 text-center">No matches. Try a different search.</div>
        )}
      </div>
    </SlideInPanel>
  );
}

// ---------------- SET ROWS EDITOR ----------------
// Shared by the standalone logger's "Today's sets" and the edit panel's "Sets" — each set
// row can carry its own nested drops array, added/removed independently of the set itself.
// Row shape while editing: { weight: string, reps: string, drops: [{weight, reps}, ...] }.
function SetRowsEditor({ sets, onChange, rirSystem = "rir", simple = false }) {
  const updateSetRow = (idx, field, val) => onChange(sets.map((row, i) => (i === idx ? { ...row, [field]: val } : row)));
  const addSetRow = () => onChange([...sets, { weight: "", reps: "", drops: [], setType: "working", rir: "", rpe: "" }]);
  const removeSetRow = (idx) => onChange(sets.filter((_, i) => i !== idx));
  // Quick logging: nudge a row's weight/reps without retyping, or clone it as the next set —
  // the common case mid-workout is "same weight, one more rep" or "just repeat that."
  const bumpField = (idx, field, delta) =>
    onChange(
      sets.map((row, i) => {
        if (i !== idx) return row;
        const current = row[field] === "" ? 0 : Number(row[field]);
        return { ...row, [field]: String(Math.max(0, current + delta)) };
      })
    );
  const duplicateSetRow = (idx) =>
    onChange([...sets.slice(0, idx + 1), { ...sets[idx], drops: (sets[idx].drops || []).map((d) => ({ ...d } )) }, ...sets.slice(idx + 1)]);
  const addDropRow = (idx) =>
    onChange(sets.map((row, i) => (i === idx ? { ...row, drops: [...(row.drops || []), { weight: "", reps: "" }] } : row)));
  const updateDropRow = (idx, dIdx, field, val) =>
    onChange(
      sets.map((row, i) =>
        i === idx ? { ...row, drops: row.drops.map((d, di) => (di === dIdx ? { ...d, [field]: val } : d)) } : row
      )
    );
  const removeDropRow = (idx, dIdx) =>
    onChange(sets.map((row, i) => (i === idx ? { ...row, drops: row.drops.filter((_, di) => di !== dIdx) } : row)));

  return (
    <div className="space-y-3">
      {sets.map((row, idx) => (
        <div key={idx} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-600 w-5">{idx + 1}</span>
            <input
              type="number"
              placeholder="Weight"
              value={row.weight}
              onChange={(e) => updateSetRow(idx, "weight", e.target.value)}
              className="flex-1 min-w-0 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-base focus:outline-none focus:border-red-700"
            />
            <input
              type="number"
              placeholder="Reps"
              value={row.reps}
              onChange={(e) => updateSetRow(idx, "reps", e.target.value)}
              className="flex-1 min-w-0 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-base focus:outline-none focus:border-red-700"
            />
            {sets.length > 1 && (
              <button onClick={() => removeSetRow(idx)} className="text-neutral-600 hover:text-red-600 p-1">
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 pl-7 overflow-x-auto">
            <button
              onClick={() => bumpField(idx, "weight", -5)}
              className="shrink-0 px-2 py-1 text-[11px] font-bold border border-neutral-800 text-neutral-400 hover:border-neutral-600"
            >
              -5
            </button>
            <button
              onClick={() => bumpField(idx, "weight", 5)}
              className="shrink-0 px-2 py-1 text-[11px] font-bold border border-neutral-800 text-neutral-400 hover:border-neutral-600"
            >
              +5 wt
            </button>
            <button
              onClick={() => bumpField(idx, "reps", 1)}
              className="shrink-0 px-2 py-1 text-[11px] font-bold border border-neutral-800 text-neutral-400 hover:border-neutral-600"
            >
              +1 rep
            </button>
            <button
              onClick={() => duplicateSetRow(idx)}
              className="shrink-0 flex items-center gap-1 px-2 py-1 text-[11px] font-bold border border-neutral-800 text-neutral-400 hover:border-neutral-600"
            >
              <Copy size={10} /> Duplicate
            </button>
          </div>
          {!simple && (
            <>
              <div className="flex items-center gap-1 pl-7 overflow-x-auto">
                {SET_TYPES.map((t) => {
                  const active = (row.setType || "working") === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => updateSetRow(idx, "setType", t.value)}
                      className={`shrink-0 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${
                        active ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-500 hover:border-neutral-600"
                      }`}
                    >
                      {t.short}
                    </button>
                  );
                })}
                <input
                  type="number"
                  placeholder={rirSystem === "rpe" ? "RPE" : "RIR"}
                  value={rirSystem === "rpe" ? row.rpe ?? "" : row.rir ?? ""}
                  onChange={(e) => updateSetRow(idx, rirSystem === "rpe" ? "rpe" : "rir", e.target.value)}
                  className="shrink-0 w-14 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-1.5 py-0.5 text-[11px] text-center focus:outline-none focus:border-red-700"
                />
              </div>
              {(row.drops || []).map((drop, dIdx) => (
                <div key={dIdx} className="flex items-center gap-2 pl-7">
                  <span className="text-xs text-neutral-700">↳</span>
                  <input
                    type="number"
                    placeholder="Drop weight"
                    value={drop.weight}
                    onChange={(e) => updateDropRow(idx, dIdx, "weight", e.target.value)}
                    className="flex-1 min-w-0 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
                  />
                  <input
                    type="number"
                    placeholder="Drop reps"
                    value={drop.reps}
                    onChange={(e) => updateDropRow(idx, dIdx, "reps", e.target.value)}
                    className="flex-1 min-w-0 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
                  />
                  <button onClick={() => removeDropRow(idx, dIdx)} className="text-neutral-600 hover:text-red-600 p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button onClick={() => addDropRow(idx)} className="pl-7 flex items-center gap-1 text-[11px] text-neutral-600 hover:text-red-500">
                <Plus size={11} /> Add drop
              </button>
            </>
          )}
        </div>
      ))}
      <button onClick={addSetRow} className="flex items-center gap-1 text-xs text-neutral-500 hover:text-red-500">
        <Plus size={12} /> Add set
      </button>
    </div>
  );
}

// ---------------- EDIT LOGGED ENTRY ----------------
// Lets a previously-saved history entry be corrected (weight/reps per set and per drop,
// target reps) or deleted outright. Edits flow back through the same state.logs array, so
// suggestNext recomputes automatically off the corrected numbers.
function EditLogEntryPanel({ entry, exMap, onBack, onSave, onDelete, rirSystem = "rir", simple = false }) {
  const [sets, setSets] = useState(
    entry.sets.map((s) => ({
      weight: String(s.weight),
      reps: String(s.reps),
      drops: (s.drops || []).map((d) => ({ weight: String(d.weight), reps: String(d.reps) })),
      setType: s.setType || "working",
      rir: s.rir != null ? String(s.rir) : "",
      rpe: s.rpe != null ? String(s.rpe) : "",
    }))
  );
  const [targetReps, setTargetReps] = useState(String(entry.targetReps));

  const canSave = sets.some((s) => s.weight !== "" && s.reps !== "");

  const handleSave = () => {
    const cleanSets = cleanSetsInput(sets);
    if (cleanSets.length === 0) return;
    onSave({ sets: cleanSets, targetReps: Number(targetReps) || cleanSets[0].reps });
  };

  return (
    <SlideInPanel
      title={exMap[entry.exId]?.name || entry.exId}
      subtitle={new Date(entry.date).toLocaleDateString()}
      onBack={onBack}
    >
      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Target reps</label>
        <input
          type="number"
          value={targetReps}
          onChange={(e) => setTargetReps(e.target.value)}
          className="w-24 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-base focus:outline-none focus:border-red-700"
        />
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-2">Sets</label>
        <SetRowsEditor sets={sets} onChange={setSets} rirSystem={rirSystem} simple={simple} />
      </div>

      <button
        onClick={handleSave}
        disabled={!canSave}
        className={`w-full py-3 text-xs uppercase tracking-widest font-bold border ${
          canSave
            ? "bg-red-700 border-red-700 text-white hover:bg-red-600"
            : "bg-charcoal-panel border-neutral-800 text-neutral-700 cursor-not-allowed"
        }`}
      >
        Save changes
      </button>
      <button
        onClick={onDelete}
        className="w-full py-3 text-xs uppercase tracking-widest font-bold border border-neutral-800 bg-charcoal-panel text-neutral-400 hover:text-red-500 hover:border-red-900/40 flex items-center justify-center gap-1.5"
      >
        <Trash2 size={14} /> Delete entry
      </button>
    </SlideInPanel>
  );
}

// ---------------- SHARED SINGLE-EXERCISE LOGGER ----------------
// Recommended panel + target reps + set rows + save + history, for a fixed exercise.
// Used standalone by the Log tab (with its own exercise picker wrapped around it) and
// by the guided plan runner (with a plan-driven step indicator wrapped around it).
// ---------------- EXERCISE NOTES ----------------
// Persistent per-exercise notes (general / machine setup / technique cue), keyed by exId in
// state.exerciseNotes. Shown collapsed-to-a-summary the moment there's anything saved, so
// they surface automatically every time this exercise is opened — no digging required.
function ExerciseNotesPanel({ exId, state, updateState }) {
  const saved = state.exerciseNotes?.[exId] || { general: "", machine: "", cue: "" };
  const hasAny = !!(saved.general || saved.machine || saved.cue);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(saved);

  useEffect(() => {
    setDraft(state.exerciseNotes?.[exId] || { general: "", machine: "", cue: "" });
    setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exId]);

  const save = () => {
    updateState((prev) => ({ ...prev, exerciseNotes: { ...(prev.exerciseNotes || {}), [exId]: draft } }));
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-3">
        <div className="text-[11px] uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
          <StickyNote size={12} /> Exercise notes
        </div>
        {[
          ["machine", "Machine / setup", "e.g. Seat 4, pin 9, bench angle 30°"],
          ["cue", "Technique cue", "e.g. Neutral grip, strap in on final sets"],
          ["general", "General", "Anything else worth remembering"],
        ].map(([key, label, placeholder]) => (
          <div key={key}>
            <label className="block text-[10px] uppercase tracking-widest text-neutral-600 mb-1">{label}</label>
            <input
              type="text"
              value={draft[key] || ""}
              onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
            />
          </div>
        ))}
        <div className="flex gap-2">
          <button
            onClick={save}
            className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600"
          >
            Save notes
          </button>
          <button
            onClick={() => {
              setDraft(saved);
              setEditing(false);
            }}
            className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-400 hover:border-neutral-600"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="w-full text-left border border-neutral-800 bg-charcoal-panel p-3 hover:border-neutral-700"
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
          <StickyNote size={12} /> Notes
        </div>
        <span className="text-[11px] text-red-500">{hasAny ? "Edit" : "+ Add"}</span>
      </div>
      {hasAny ? (
        <div className="mt-1.5 space-y-0.5 text-sm text-neutral-300">
          {saved.machine && (
            <div>
              <span className="text-neutral-600">Setup: </span>
              {saved.machine}
            </div>
          )}
          {saved.cue && (
            <div>
              <span className="text-neutral-600">Cue: </span>
              {saved.cue}
            </div>
          )}
          {saved.general && (
            <div>
              <span className="text-neutral-600">Note: </span>
              {saved.general}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-1 text-xs text-neutral-600">Seat position, pin, grip, cues…</div>
      )}
    </button>
  );
}

// ---------------- PLATE CALCULATOR ----------------
function PlateCalculator({ defaultWeight, barWeight }) {
  const [target, setTarget] = useState(defaultWeight != null ? String(defaultWeight) : "");
  useEffect(() => {
    if (defaultWeight != null) setTarget(String(defaultWeight));
  }, [defaultWeight]);
  const num = Number(target) || 0;
  const { plates, remainder } = platesPerSide(num, barWeight);

  return (
    <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
          <Calculator size={12} /> Plate calculator
        </div>
        <span className="text-[11px] text-neutral-600">Bar: {barWeight} lb</span>
      </div>
      <input
        type="number"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        placeholder="Target weight"
        className="w-full bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-base focus:outline-none focus:border-red-700"
      />
      {num > barWeight ? (
        <div>
          <div className="text-xs text-neutral-500 mb-1.5">Per side</div>
          {plates.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {plates.map((p, i) => (
                <span key={i} className="px-2.5 py-1 text-sm font-bold bg-charcoal-deep border border-neutral-700 text-white">
                  {p}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-sm text-neutral-500">Bar only</div>
          )}
          {remainder > 0.01 && (
            <div className="text-[11px] text-neutral-600 mt-1.5">
              {remainder} lb per side can't be made exactly with standard plates.
            </div>
          )}
        </div>
      ) : num > 0 ? (
        <div className="text-xs text-neutral-500">
          {num} lb is at or below the bar ({barWeight} lb).
        </div>
      ) : null}
    </div>
  );
}

// Collapsed by default so it doesn't compete for space with the actual logging flow — one
// tap reveals it prefilled with the recommended weight.
function PlateCalculatorToggle({ defaultWeight, barWeight }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-neutral-500 hover:text-red-500"
      >
        <Calculator size={12} /> Plate calculator {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="mt-2">
          <PlateCalculator defaultWeight={defaultWeight} barWeight={barWeight} />
        </div>
      )}
    </div>
  );
}

const BLANK_SET_ROW = { weight: "", reps: "", drops: [], setType: "working", rir: "", rpe: "" };

function ExerciseLogger({ exId, title, state, updateState, exMap, allExercises, onSaved, onSwap, saveLabel = "Save session", showHistory = true }) {
  const [targetReps, setTargetReps] = useState(8);
  const [setsInput, setSetsInput] = useState([{ ...BLANK_SET_ROW, drops: [] }]);
  const [swapOpen, setSwapOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const rirSystem = state.settings?.rirSystem || "rir";
  const isSimple = (state.settings?.trainingDetail || "advanced") === "simple";

  const suggestion = useMemo(
    () => suggestNext(exId, state.logs, exMap, { readinessLogs: state.readinessLogs }),
    [exId, state.logs, exMap, state.readinessLogs]
  );

  useEffect(() => {
    setTargetReps(suggestion.targetReps ?? 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exId]);

  const canSave = setsInput.some((s) => s.weight !== "" && s.reps !== "");

  const saveLog = () => {
    const sets = cleanSetsInput(setsInput);
    if (sets.length === 0) return;
    const entry = {
      id: `log_${Date.now()}`,
      exId,
      date: new Date().toISOString(),
      sets,
      targetReps: Number(targetReps) || sets[0].reps,
    };
    updateState((prev) => ({ ...prev, logs: [entry, ...prev.logs], hasSeenOnboarding: true }));
    setSetsInput([{ ...BLANK_SET_ROW, drops: [] }]);
    onSaved?.(entry);
  };

  const recentForEx = state.logs
    .filter((l) => l.exId === exId)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  if (swapOpen) {
    return (
      <ExerciseSwapPicker
        currentExId={exId}
        allExercises={allExercises}
        exMap={exMap}
        onBack={() => setSwapOpen(false)}
        onSelect={(newExId) => {
          setSwapOpen(false);
          onSwap(newExId);
        }}
      />
    );
  }

  if (editingEntryId) {
    const entry = state.logs.find((l) => l.id === editingEntryId);
    if (!entry) {
      return (
        <SlideInPanel title="Entry not found" onBack={() => setEditingEntryId(null)}>
          <div className="text-sm text-neutral-500">This entry no longer exists.</div>
        </SlideInPanel>
      );
    }
    return (
      <EditLogEntryPanel
        entry={entry}
        exMap={exMap}
        rirSystem={rirSystem}
        simple={isSimple}
        onBack={() => setEditingEntryId(null)}
        onSave={(changes) => {
          updateState((prev) => ({
            ...prev,
            logs: prev.logs.map((l) => (l.id === editingEntryId ? { ...l, ...changes } : l)),
          }));
          setEditingEntryId(null);
        }}
        onDelete={() => {
          if (!window.confirm("Delete this logged entry? This can't be undone.")) return;
          updateState((prev) => ({ ...prev, logs: prev.logs.filter((l) => l.id !== editingEntryId) }));
          setEditingEntryId(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {title && (
        <div className="flex items-center justify-between gap-2">
          <div className="text-xl font-bold text-white truncate">{title}</div>
          {onSwap && (
            <button
              onClick={() => setSwapOpen(true)}
              className="shrink-0 text-[11px] uppercase tracking-widest text-neutral-500 hover:text-red-500 flex items-center gap-1"
            >
              <ArrowLeftRight size={12} /> Swap
            </button>
          )}
        </div>
      )}

      <ExerciseNotesPanel exId={exId} state={state} updateState={updateState} />

      {recentForEx.length > 0 && (
        <div className="border border-neutral-800 bg-charcoal-panel p-4">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">Last time</div>
          <div className="space-y-1">
            {recentForEx[0].sets.map((s, i) => (
              <div key={i} className="text-lg text-neutral-200">
                {formatSetCompact(s)}
              </div>
            ))}
          </div>
          <div className="text-xs text-neutral-600 mt-2">{new Date(recentForEx[0].date).toLocaleDateString()}</div>
        </div>
      )}

      <div className="border border-red-900/40 bg-charcoal-panel p-4">
        <div className="text-[11px] uppercase tracking-widest text-red-600 mb-2">Recommended</div>
        {suggestion.suggestion !== null ? (
          <>
            <div className="text-4xl font-bold text-white">{suggestion.suggestion} lb x {suggestion.targetReps} reps</div>
            <div className="text-xs text-neutral-500 mt-1">{suggestion.reason}</div>
            {recentForEx.length > 0 && <div className="text-sm text-neutral-600 mt-2">Goal: beat last session without losing form.</div>}
            <button
              onClick={() => {
                setTargetReps(suggestion.targetReps ?? 8);
                setSetsInput((rows) =>
                  rows.map((r, i) =>
                    i === 0 ? { ...r, weight: String(suggestion.suggestion), reps: String(suggestion.targetReps) } : r
                  )
                );
              }}
              className="mt-3 text-[11px] uppercase tracking-widest text-red-500 hover:text-red-400"
            >
              Use suggested — fill set 1
            </button>
          </>
        ) : (
          <div className="text-sm text-neutral-400">{suggestion.reason}</div>
        )}
      </div>

      <PlateCalculatorToggle defaultWeight={suggestion.suggestion ?? undefined} barWeight={state.settings?.barWeight || 45} />

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Target reps this session</label>
        <input
          type="number"
          value={targetReps}
          onChange={(e) => setTargetReps(e.target.value)}
          className="w-24 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-base focus:outline-none focus:border-red-700"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-[11px] uppercase tracking-widest text-neutral-500">Today's sets</label>
          {recentForEx.length > 0 && (
            <button
              onClick={() =>
                setSetsInput(
                  recentForEx[0].sets.map((s) => ({
                    weight: String(s.weight),
                    reps: String(s.reps),
                    drops: (s.drops || []).map((d) => ({ weight: String(d.weight), reps: String(d.reps) })),
                    setType: s.setType || "working",
                    rir: s.rir != null ? String(s.rir) : "",
                    rpe: s.rpe != null ? String(s.rpe) : "",
                  }))
                )
              }
              className="flex items-center gap-1 text-[11px] uppercase tracking-widest text-neutral-500 hover:text-red-500"
            >
              <Copy size={11} /> Copy last workout
            </button>
          )}
        </div>
        <SetRowsEditor sets={setsInput} onChange={setSetsInput} rirSystem={rirSystem} simple={isSimple} />
      </div>

      <button
        onClick={saveLog}
        disabled={!canSave}
        className={`w-full py-3 text-xs uppercase tracking-widest font-bold border ${
          canSave
            ? "bg-red-700 border-red-700 text-white hover:bg-red-600"
            : "bg-charcoal-panel border-neutral-800 text-neutral-700 cursor-not-allowed"
        }`}
      >
        {saveLabel}
      </button>

      {showHistory && recentForEx.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">History</div>
          <div className="space-y-1.5">
            {recentForEx.map((l) => (
              <button
                key={l.id}
                onClick={() => setEditingEntryId(l.id)}
                className="w-full flex items-center justify-between text-xs border-b border-neutral-900 py-2 text-left hover:border-neutral-700"
              >
                <span className="text-neutral-500">{new Date(l.date).toLocaleDateString()}</span>
                <span className="text-sm text-neutral-300">{l.sets.map(formatSetCompact).join(", ")}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- ONBOARDING ----------------
// Shown in place of the Log tab only for a genuinely fresh install — no logs, no cardio
// logs, no active program — until the user logs anything or starts a program, at which
// point hasSeenOnboarding latches true for good (see startRun / saveLog / saveEntry).
function OnboardingView({ state, onStartRun, onGoToTemplates }) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-3 py-2">
        <img
          src={BREAK_LOGO}
          alt="B.R.E.A.K. logo"
          className="w-16 h-16 rounded-full object-cover ring-1 ring-red-700/60 mx-auto"
        />
        <div>
          <div className="text-xl font-bold text-white">Welcome to BRK - Lift</div>
          <p className="text-sm text-neutral-400 mt-2 max-w-sm mx-auto">
            Log every set, follow a structured multi-day program, and let the app tell you what to lift next. Pick a
            program below to start Day 1 right now.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-widest text-red-600">Pick a program</div>
        {(state.programs || []).map((prog) => (
          <div key={prog.id} className="border border-red-900/40 bg-charcoal-panel p-4 space-y-2">
            <div>
              <div className="text-base font-medium text-white">{prog.name}</div>
              <div className="text-xs text-neutral-500 mt-0.5">
                {prog.tagline}
                {prog.weeks ? ` · ${prog.weeks} weeks` : ""}
              </div>
            </div>
            <button
              onClick={() =>
                onStartRun(
                  { name: `${prog.name} — ${prog.days[0].label}`, exercises: prog.days[0].exercises },
                  { programId: prog.id, programName: prog.name, source: "builtin", dayIndex: 0, totalDays: prog.days.length }
                )
              }
              className="w-full py-2 text-xs uppercase tracking-widest font-bold border border-red-700 bg-red-700 text-white hover:bg-red-600 flex items-center justify-center gap-1.5"
            >
              <ChevronRight size={12} /> Start Day 1
            </button>
          </div>
        ))}
      </div>

      <button onClick={onGoToTemplates} className="w-full text-center text-xs text-neutral-500 hover:text-red-500 py-2">
        Or browse everything in Templates
      </button>
    </div>
  );
}

// ---------------- LOG TAB ----------------
// ---------------- PR CELEBRATION ----------------
function prHeadline(prs) {
  return prs.find((p) => p.type === "weight") || prs.find((p) => p.type === "e1rm") || prs.find((p) => p.type === "reps") || prs[0];
}
function prLine(pr) {
  switch (pr.type) {
    case "weight":
      return `Heaviest weight: ${pr.weight} lb (+${Math.round((pr.weight - pr.prev) * 10) / 10} lb vs previous best ${pr.prev} lb)`;
    case "reps":
      return `Rep record @ ${pr.weight} lb: ${pr.reps} reps${pr.prev > 0 ? ` (prev ${pr.prev})` : ""}`;
    case "e1rm":
      return `Estimated 1RM: ${pr.value} lb (+${pr.value - pr.prev} lb vs previous best)`;
    case "exerciseVolume":
      return `Exercise volume: ${pr.value.toLocaleString()} lb (+${(pr.value - pr.prev).toLocaleString()} lb)`;
    default:
      return "";
  }
}
// Aggressive-but-clean celebration, shown once a set breaks a PR. Used both in the standalone
// Log tab (dismissible) and pinned to a collapsed "logged" card in the guided run (permanent
// for the session, since that card is the one thing that survives after the exercise input
// collapses away).
function PRCallout({ exMap, exId, prs, onDismiss }) {
  if (!prs || prs.length === 0) return null;
  const headline = prHeadline(prs);
  return (
    <div className="border border-red-700 bg-red-950/30 p-4 space-y-2 relative">
      {onDismiss && (
        <button onClick={onDismiss} className="absolute top-2 right-2 text-neutral-500 hover:text-white">
          <X size={14} />
        </button>
      )}
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-red-500">
        <Award size={14} /> New PR
      </div>
      <div className="text-lg font-bold text-white truncate pr-6">{exMap[exId]?.name || exId}</div>
      {headline && headline.weight != null && (
        <div className="text-2xl font-bold text-white">
          {headline.weight} × {headline.reps}
        </div>
      )}
      <div className="space-y-0.5 text-sm text-neutral-300">
        {prs.map((pr, i) => (
          <div key={i}>{prLine(pr)}</div>
        ))}
      </div>
      <div className="pt-1">
        <ShareCardButton buildDataUrl={() => buildPRShareCard(exMap[exId]?.name || exId, prs)} filename="brk-lift-pr.png" />
      </div>
    </div>
  );
}

function LogTab({ state, updateState, allExercises, exMap, onStartRun, onLoggedSet, onRestartProgram, onGoToTemplates }) {
  const [selectedExId, setSelectedExId] = useState(allExercises[0].id);
  const [exFilter, setExFilter] = useState("");
  const [prBanner, setPrBanner] = useState(null);

  useEffect(() => setPrBanner(null), [selectedExId]);

  const filteredExercises = useMemo(() => {
    const q = exFilter.trim().toLowerCase();
    if (!q) return allExercises;
    return allExercises.filter((ex) => ex.name.toLowerCase().includes(q) || ex.muscle.toLowerCase().includes(q));
  }, [exFilter, allExercises]);

  const groupedByMuscle = useMemo(() => {
    const groups = {};
    filteredExercises.forEach((ex) => {
      if (!groups[ex.muscle]) groups[ex.muscle] = [];
      groups[ex.muscle].push(ex);
    });
    return groups;
  }, [filteredExercises]);

  const currentProgramDay = useMemo(() => resolveCurrentProgramDay(state), [state]);

  return (
    <div className="space-y-6">
      <ReadinessCheckIn state={state} updateState={updateState} />

      {currentProgramDay?.isComplete && (
        <div className="border border-red-900/40 bg-charcoal-panel px-4 py-3 space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-red-600">Program complete</div>
            <div className="text-base text-white mt-0.5">
              {currentProgramDay.programName} — {currentProgramDay.totalWeeks} weeks done
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRestartProgram}
              className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border border-red-700 bg-red-700 text-white hover:bg-red-600"
            >
              Restart
            </button>
            <button
              onClick={onGoToTemplates}
              className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border border-neutral-800 bg-charcoal-panel text-neutral-200 hover:border-neutral-600"
            >
              New program
            </button>
          </div>
        </div>
      )}

      {currentProgramDay && !currentProgramDay.isComplete && (
        <div className="border border-red-900/40 bg-charcoal-panel px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-red-600">Current program</div>
            <div className="text-base text-white mt-0.5 truncate">
              {currentProgramDay.programName}
              {currentProgramDay.weekNumber !== null
                ? ` — Week ${currentProgramDay.weekNumber} of ${currentProgramDay.totalWeeks}, Day ${currentProgramDay.dayIndex + 1} of ${currentProgramDay.totalDays}`
                : ` — Day ${currentProgramDay.dayIndex + 1} of ${currentProgramDay.totalDays}`}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5 truncate">{currentProgramDay.dayLabel}</div>
          </div>
          <button
            onClick={() => onStartRun(currentProgramDay.plan, currentProgramDay.programContext)}
            className="shrink-0 ml-3 text-xs text-red-500 hover:text-red-400 flex items-center gap-1"
          >
            <ChevronRight size={14} /> Start
          </button>
        </div>
      )}

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Exercise</label>
        <input
          type="text"
          value={exFilter}
          onChange={(e) => setExFilter(e.target.value)}
          placeholder="Search the catalog..."
          className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-xs mb-2 focus:outline-none focus:border-red-700"
        />
        <select
          value={selectedExId}
          onChange={(e) => setSelectedExId(e.target.value)}
          className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2.5 text-sm focus:outline-none focus:border-red-700"
        >
          {Object.entries(groupedByMuscle).map(([muscle, exs]) => (
            <optgroup key={muscle} label={muscle}>
              {exs.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {filteredExercises.length === 0 && (
          <div className="text-xs text-neutral-600 mt-1.5">
            No match. Add it in the Catalog tab and it'll show up here.
          </div>
        )}
      </div>

      {prBanner && <PRCallout exMap={exMap} exId={prBanner.exId} prs={prBanner.prs} onDismiss={() => setPrBanner(null)} />}

      <ExerciseLogger
        exId={selectedExId}
        title={exMap[selectedExId]?.name}
        state={state}
        updateState={updateState}
        exMap={exMap}
        allExercises={allExercises}
        onSwap={setSelectedExId}
        onSaved={(entry) => {
          const prs = detectPRs(entry.exId, entry, state.logs);
          setPrBanner(prs.length > 0 ? { exId: entry.exId, prs } : null);
          onLoggedSet(entry);
        }}
      />
    </div>
  );
}

// ---------------- REST TIMER ----------------
// Sticky widget with fixed presets (1:00 / 1:30 / 2:00 / 3:00) plus a category-aware
// auto-start: whenever a set is logged, the caller computes the right default (compound /
// isolation / conditioning / superset, from Settings) and bumps { token, seconds }.
const REST_PRESETS = [60, 90, 120, 180];

function formatRestTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

// Web Audio (not an <audio> element) so the beep mixes with whatever the user is already
// playing (Spotify/Apple Music/etc.) instead of pausing it, the way <audio>/<video> often do
// on mobile. A single AudioContext is reused and resumed on user gestures (autoplay policy
// requires that) so it's already unlocked by the time the countdown actually hits zero.
let sharedAudioCtx = null;
function unlockAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  if (!sharedAudioCtx) sharedAudioCtx = new Ctx();
  if (sharedAudioCtx.state === "suspended") sharedAudioCtx.resume();
}
function playRestCompleteBeep() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  if (!sharedAudioCtx) sharedAudioCtx = new Ctx();
  const ctx = sharedAudioCtx;
  if (ctx.state === "suspended") ctx.resume();
  const now = ctx.currentTime;
  [0, 0.22, 0.44].forEach((offset) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0, now + offset);
    gain.gain.linearRampToValueAtTime(0.35, now + offset + 0.015);
    gain.gain.linearRampToValueAtTime(0, now + offset + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.2);
  });
}

// Global rest timer widget — mounted once at the app shell so it survives tab switches.
// Idle state is a slim bar; the instant it's running (or just hit zero) it expands into a
// large, high-contrast readout meant to be legible from across a gym, with a vibration +
// flash + beep on completion.
function RestTimer({ bump }) {
  const [duration, setDuration] = useState(90);
  const [remaining, setRemaining] = useState(null);
  const [paused, setPaused] = useState(false);
  const [justFinished, setJustFinished] = useState(false);

  useEffect(() => {
    if (remaining === null || remaining <= 0 || paused) return;
    const id = setInterval(() => setRemaining((r) => (r === null ? null : r - 1)), 1000);
    return () => clearInterval(id);
  }, [remaining, paused]);

  useEffect(() => {
    if (remaining !== 0) return;
    playRestCompleteBeep();
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
    setJustFinished(true);
    const id = setTimeout(() => setJustFinished(false), 2000);
    return () => clearTimeout(id);
  }, [remaining]);

  // Compares against the last-seen bump token (rather than a "have I ever run" flag) so
  // React StrictMode's double-invoke-on-commit in dev can't misfire this as a real bump.
  const lastBumpToken = useRef(bump.token);
  useEffect(() => {
    if (bump.token === lastBumpToken.current) return;
    lastBumpToken.current = bump.token;
    unlockAudio();
    setDuration(bump.seconds);
    setRemaining(bump.seconds);
    setPaused(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bump.token]);

  const startPreset = (secs) => {
    unlockAudio();
    setDuration(secs);
    setRemaining(secs);
    setPaused(false);
  };
  const addSeconds = (n) => setRemaining((r) => (r === null ? n : r + n));
  const skip = () => {
    setRemaining(null);
    setPaused(false);
  };
  const reset = () => {
    setRemaining(duration);
    setPaused(false);
  };
  const togglePause = () => setPaused((p) => !p);

  const isActive = remaining !== null;

  return (
    <div
      className={`border-b border-red-900/40 bg-charcoal-panel px-4 transition-colors ${
        justFinished ? "animate-rest-flash" : ""
      } ${isActive ? "py-5" : "py-2.5"}`}
    >
      <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-red-600 ${isActive ? "mb-3 justify-center" : "mb-2"}`}>
        <Timer size={12} /> Rest timer
      </div>

      {isActive ? (
        <div className="space-y-3">
          <div className="text-center">
            {remaining > 0 ? (
              <div className={`text-7xl font-bold tabular-nums leading-none ${paused ? "text-neutral-500" : "text-white"}`}>
                {formatRestTime(remaining)}
              </div>
            ) : (
              <div className="text-4xl font-bold text-red-500 leading-none">Rest complete</div>
            )}
            {paused && remaining > 0 && <div className="text-[11px] uppercase tracking-widest text-neutral-500 mt-1">Paused</div>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => addSeconds(30)}
              className="flex-1 py-3 text-sm uppercase tracking-widest font-bold border border-neutral-800 bg-charcoal-panel text-neutral-200 hover:border-neutral-600"
            >
              +30s
            </button>
            <button
              onClick={() => addSeconds(60)}
              className="flex-1 py-3 text-sm uppercase tracking-widest font-bold border border-neutral-800 bg-charcoal-panel text-neutral-200 hover:border-neutral-600"
            >
              +60s
            </button>
            <button
              onClick={skip}
              className="flex-1 py-3 text-sm uppercase tracking-widest font-bold border border-red-700 bg-red-700 text-white hover:bg-red-600"
            >
              Skip
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={togglePause}
              className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border border-neutral-800 bg-charcoal-panel text-neutral-300 hover:border-neutral-600 flex items-center justify-center gap-1.5"
            >
              {paused ? <Play size={12} /> : <Pause size={12} />} {paused ? "Resume" : "Pause"}
            </button>
            <button
              onClick={reset}
              className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border border-neutral-800 bg-charcoal-panel text-neutral-300 hover:border-neutral-600 flex items-center justify-center gap-1.5"
            >
              <RotateCcw size={12} /> Reset
            </button>
          </div>
        </div>
      ) : null}

      <div className={`flex items-center gap-2 ${isActive ? "mt-4" : ""}`}>
        {REST_PRESETS.map((secs) => (
          <button
            key={secs}
            onClick={() => startPreset(secs)}
            className={`flex-1 py-1.5 text-xs font-bold border ${
              isActive && duration === secs
                ? "bg-red-700 border-red-700 text-white"
                : "bg-charcoal-panel border-neutral-800 text-neutral-300 hover:border-neutral-600"
            }`}
          >
            {formatRestTime(secs)}
          </button>
        ))}
      </div>
    </div>
  );
}

// Today's readiness in the small { loggedToday, score, band } shape the coach service
// expects — shared by the pre-workout card below and buildCoachContext.
function todayReadinessSummary(state) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const entry = (state.readinessLogs || []).find((r) => r.date.slice(0, 10) === todayKey);
  if (!entry) return { loggedToday: false };
  const score = computeReadinessScore(entry);
  return { loggedToday: true, score, band: readinessBand(score) };
}

// ---------------- TRAINING MODE: ONE-SET-AT-A-TIME CARD ----------------
// Purpose-built for the guided run's *active* exercise only — large steppers (the number
// between the +/- buttons is a real input, so typing is still "manual entry"), one dominant
// Save Set button, and a per-set rest-timer bump via onSetSaved. Writes the exact same
// { id, exId, date, sets, targetReps } shape to state.logs that ExerciseLogger always has, via
// the same onSaved(entry) contract GuidedRunView already wires up — so detectPRs, suggestNext,
// buildSessionSummary and exports don't need to know this exists. The standalone Log tab and
// history-edit flow keep using ExerciseLogger/SetRowsEditor untouched.
const RIR_CHIPS = [3, 2, 1, 0];
const RPE_CHIPS = [7, 8, 9, 10];

function TrainingExerciseCard({ exId, exSlot, state, updateState, exMap, allExercises, onSaved, onSwap, onSetSaved }) {
  const rirSystem = state.settings?.rirSystem || "rir";
  const trainingDetail = state.settings?.trainingDetail || "advanced";
  const isSimple = trainingDetail === "simple";

  const suggestion = useMemo(
    () => suggestNext(exId, state.logs, exMap, { readinessLogs: state.readinessLogs }),
    [exId, state.logs, exMap, state.readinessLogs]
  );
  const recentForEx = useMemo(
    () => state.logs.filter((l) => l.exId === exId).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3),
    [state.logs, exId]
  );
  const targetSetCount = exSlot?.sets || recentForEx[0]?.sets.length || 3;

  const [confirmedSets, setConfirmedSets] = useState([]);
  const [weight, setWeight] = useState(suggestion.suggestion ?? "");
  const [reps, setReps] = useState(suggestion.targetReps ?? 8);
  const [rirVal, setRirVal] = useState("");
  const [setType, setSetType] = useState("working");
  const [drops, setDrops] = useState([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [addingExtra, setAddingExtra] = useState(false);

  const chips = rirSystem === "rpe" ? RPE_CHIPS : RIR_CHIPS;
  const showDraft = confirmedSets.length < targetSetCount || addingExtra;

  const bumpWeight = (delta) => setWeight((w) => Math.max(0, (Number(w) || 0) + delta));
  const bumpReps = (delta) => setReps((r) => Math.max(0, (Number(r) || 0) + delta));

  const saveSet = () => {
    if (weight === "" || reps === "") return;
    const raw = {
      weight,
      reps,
      drops,
      setType,
      rir: rirSystem === "rir" ? rirVal : "",
      rpe: rirSystem === "rpe" ? rirVal : "",
    };
    const cleaned = cleanSetsInput([raw])[0];
    setConfirmedSets((prev) => [...prev, cleaned]);
    onSetSaved?.();
    setRirVal("");
    setSetType("working");
    setDrops([]);
    setAdvancedOpen(false);
    setAddingExtra(false);
  };

  const finishExercise = () => {
    if (confirmedSets.length === 0) return;
    const entry = {
      id: `log_${Date.now()}`,
      exId,
      date: new Date().toISOString(),
      sets: confirmedSets,
      targetReps: Number(reps) || confirmedSets[0].reps,
    };
    updateState((prev) => ({ ...prev, logs: [entry, ...prev.logs], hasSeenOnboarding: true }));
    onSaved?.(entry);
  };

  const useSuggested = () => {
    if (suggestion.suggestion == null) return;
    setWeight(suggestion.suggestion);
    setReps(suggestion.targetReps ?? 8);
  };
  const duplicateLast = () => {
    const last = confirmedSets[confirmedSets.length - 1] || recentForEx[0]?.sets?.[0];
    if (!last) return;
    setWeight(last.weight);
    setReps(last.reps);
  };

  if (swapOpen) {
    return (
      <ExerciseSwapPicker
        currentExId={exId}
        allExercises={allExercises}
        exMap={exMap}
        onBack={() => setSwapOpen(false)}
        onSelect={(newExId) => {
          setSwapOpen(false);
          onSwap(newExId);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xl font-bold text-white truncate">{exMap[exId]?.name || exId}</div>
          <div className="text-xs text-neutral-500 mt-0.5">{exMap[exId]?.muscle}</div>
        </div>
        {onSwap && (
          <button
            onClick={() => setSwapOpen(true)}
            className="shrink-0 text-[11px] uppercase tracking-widest text-neutral-500 hover:text-red-500 flex items-center gap-1"
          >
            <ArrowLeftRight size={12} /> Swap
          </button>
        )}
      </div>

      {recentForEx.length > 0 && (
        <div className="text-sm text-neutral-400">
          <span className="text-neutral-600">Last time: </span>
          {formatSetsVerbose(recentForEx[0].sets)}
        </div>
      )}

      {suggestion.suggestion != null && (
        <div className="text-sm text-neutral-300">
          <span className="text-neutral-600">Today, suggested: </span>
          <span className="text-white font-bold">
            {suggestion.suggestion} lb x {suggestion.targetReps} reps
          </span>
        </div>
      )}
      {suggestion.reason && <div className="text-xs text-neutral-500">{suggestion.reason}</div>}

      {confirmedSets.length > 0 && (
        <div className="space-y-1">
          {confirmedSets.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-neutral-300">
              <Check size={13} className="text-green-500 shrink-0" />
              Set {i + 1}: {formatSetVerbose(s)}
            </div>
          ))}
        </div>
      )}

      {showDraft && (
        <div className="border border-red-900/40 bg-charcoal-panel p-4 space-y-4">
          <div className="text-[11px] uppercase tracking-widest text-red-600">
            Set {confirmedSets.length + 1}
            {targetSetCount ? ` of ${targetSetCount}` : ""}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => bumpWeight(-5)}
              className="w-12 h-12 shrink-0 text-lg font-bold border border-neutral-800 text-neutral-300 hover:border-neutral-600"
            >
              -5
            </button>
            <div className="flex-1 text-center">
              <input
                type="number"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full bg-transparent text-4xl font-bold text-white text-center focus:outline-none"
              />
              <div className="text-[10px] uppercase tracking-widest text-neutral-600">lb</div>
            </div>
            <button
              onClick={() => bumpWeight(5)}
              className="w-12 h-12 shrink-0 text-lg font-bold border border-neutral-800 text-neutral-300 hover:border-neutral-600"
            >
              +5
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => bumpReps(-1)}
              className="w-12 h-12 shrink-0 text-lg font-bold border border-neutral-800 text-neutral-300 hover:border-neutral-600"
            >
              -1
            </button>
            <div className="flex-1 text-center">
              <input
                type="number"
                inputMode="numeric"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                className="w-full bg-transparent text-4xl font-bold text-white text-center focus:outline-none"
              />
              <div className="text-[10px] uppercase tracking-widest text-neutral-600">reps</div>
            </div>
            <button
              onClick={() => bumpReps(1)}
              className="w-12 h-12 shrink-0 text-lg font-bold border border-neutral-800 text-neutral-300 hover:border-neutral-600"
            >
              +1
            </button>
          </div>

          {!isSimple && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-neutral-600 mb-1.5">
                {rirSystem === "rpe" ? "RPE" : "RIR"}
              </div>
              <div className="flex gap-1.5">
                {chips.map((c) => (
                  <button
                    key={c}
                    onClick={() => setRirVal((v) => (String(v) === String(c) ? "" : c))}
                    className={`flex-1 py-2 text-sm font-bold border ${
                      String(rirVal) === String(c)
                        ? "bg-red-700 border-red-700 text-white"
                        : "border-neutral-800 text-neutral-400 hover:border-neutral-600"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <button onClick={useSuggested} className="text-[11px] uppercase tracking-widest text-neutral-500 hover:text-red-500">
              Use suggested
            </button>
            <button onClick={duplicateLast} className="text-[11px] uppercase tracking-widest text-neutral-500 hover:text-red-500">
              Duplicate
            </button>
          </div>

          {!isSimple && (
            <div>
              <button
                onClick={() => setAdvancedOpen((o) => !o)}
                className="text-[11px] uppercase tracking-widest text-neutral-500 hover:text-red-500"
              >
                Working set {advancedOpen ? "▴" : "▾"}
              </button>
              {advancedOpen && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-1 overflow-x-auto">
                    {SET_TYPES.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setSetType(t.value)}
                        className={`shrink-0 px-2 py-1 text-[10px] font-bold uppercase tracking-wide border ${
                          setType === t.value
                            ? "bg-red-700 border-red-700 text-white"
                            : "border-neutral-800 text-neutral-500 hover:border-neutral-600"
                        }`}
                      >
                        {t.short}
                      </button>
                    ))}
                  </div>
                  {drops.map((d, di) => (
                    <div key={di} className="flex items-center gap-2">
                      <span className="text-xs text-neutral-700">↳</span>
                      <input
                        type="number"
                        placeholder="Drop weight"
                        value={d.weight}
                        onChange={(e) => setDrops((ds) => ds.map((x, i) => (i === di ? { ...x, weight: e.target.value } : x)))}
                        className="flex-1 min-w-0 bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
                      />
                      <input
                        type="number"
                        placeholder="Drop reps"
                        value={d.reps}
                        onChange={(e) => setDrops((ds) => ds.map((x, i) => (i === di ? { ...x, reps: e.target.value } : x)))}
                        className="flex-1 min-w-0 bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
                      />
                      <button onClick={() => setDrops((ds) => ds.filter((_, i) => i !== di))} className="text-neutral-600 hover:text-red-600 p-1">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setDrops((ds) => [...ds, { weight: "", reps: "" }])}
                    className="flex items-center gap-1 text-[11px] text-neutral-600 hover:text-red-500"
                  >
                    <Plus size={11} /> Add drop
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            onClick={saveSet}
            disabled={weight === "" || reps === ""}
            className={`w-full py-4 text-sm uppercase tracking-widest font-bold border ${
              weight !== "" && reps !== ""
                ? "bg-red-700 border-red-700 text-white hover:bg-red-600"
                : "bg-charcoal-panel border-neutral-800 text-neutral-700 cursor-not-allowed"
            }`}
          >
            Save set
          </button>
        </div>
      )}

      {!showDraft && confirmedSets.length >= targetSetCount && (
        <div className="space-y-2">
          <button
            onClick={finishExercise}
            className="w-full py-3 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600"
          >
            Finish exercise →
          </button>
          <button
            onClick={() => setAddingExtra(true)}
            className="w-full text-center text-[11px] uppercase tracking-widest text-neutral-500 hover:text-red-500"
          >
            + Add another set
          </button>
        </div>
      )}
      {showDraft && confirmedSets.length > 0 && confirmedSets.length < targetSetCount && (
        <button onClick={finishExercise} className="w-full text-center text-[11px] uppercase tracking-widest text-neutral-600 hover:text-red-500 py-1">
          Finish exercise now ({confirmedSets.length} set{confirmedSets.length > 1 ? "s" : ""} logged)
        </button>
      )}

      <PlateCalculatorToggle defaultWeight={weight !== "" ? weight : suggestion.suggestion ?? undefined} barWeight={state.settings?.barWeight || 45} />
      <ExerciseNotesPanel exId={exId} state={state} updateState={updateState} />
    </div>
  );
}

// ---------------- GUIDED PLAN RUNNER ----------------
// Shows every exercise in the plan on one page so the whole session is visible at once, but
// only the current, not-yet-logged exercise ever shows active input fields — logged ones
// collapse to a read-only summary (with an Edit link back into the shared edit panel), and
// not-yet-reached ones show just their name, so there's never more than one live input
// target on screen to mis-tap. Saving a set writes to the same state.logs array the
// standalone Log tab uses and bumps the rest timer. A "Finish workout" button ends the
// session; it doesn't require every exercise to be logged.
function GuidedRunView({
  run,
  state,
  updateState,
  exMap,
  allExercises,
  onSaved,
  onEditEntry,
  onDeleteEntry,
  onFinish,
  onExit,
  onSwap,
  onLoggedSet,
  onRate,
  onAskCoach,
}) {
  const [editingIdx, setEditingIdx] = useState(null);
  const [prByIndex, setPrByIndex] = useState({});
  const rirSystem = state.settings?.rirSystem || "rir";
  const isSimple = (state.settings?.trainingDetail || "advanced") === "simple";

  // Live elapsed-time clock for the Training Mode header — ticks off run.startedAt so it keeps
  // counting correctly even if the tab was backgrounded (no drift accumulation from setInterval).
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (run.finished) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [run.finished]);

  if (run.finished) {
    const summary = (state.workoutSessions || []).find((s) => s.id === run.summaryId) || null;
    return (
      <div className="space-y-6">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-red-600">{run.planName}</div>
          <div className="text-xl font-bold text-white mt-1">Session complete</div>
        </div>

        {summary && (
          <div className="border border-red-900/40 bg-charcoal-panel p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-neutral-500">Duration</div>
                <div className="text-lg font-bold text-white">{formatSessionDuration(summary.durationSec)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-neutral-500">Working sets</div>
                <div className="text-lg font-bold text-white">{summary.workingSets}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-neutral-500">Volume</div>
                <div className="text-lg font-bold text-white">
                  {summary.totalVolume.toLocaleString()} lb{summary.isVolumePR ? " — PR" : ""}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-neutral-500">Total reps</div>
                <div className="text-lg font-bold text-white">{summary.totalReps}</div>
              </div>
            </div>

            {summary.perfDeltaPct != null && (
              <div className="text-sm text-neutral-300">
                Performance vs last {summary.planName}:{" "}
                <span className={summary.perfDeltaPct >= 0 ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
                  {summary.perfDeltaPct >= 0 ? "+" : ""}
                  {summary.perfDeltaPct}%
                </span>
              </div>
            )}
            {summary.avgRir != null && (
              <div className="text-sm text-neutral-300">
                Average {rirSystem === "rpe" ? "RPE" : "RIR"}: {rirSystem === "rpe" ? Math.round((10 - summary.avgRir) * 10) / 10 : summary.avgRir}
              </div>
            )}
            {summary.mainMuscles.length > 0 && (
              <div className="text-sm text-neutral-300">Main muscles trained: {summary.mainMuscles.join(", ")}</div>
            )}
            {summary.bestLift && (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-neutral-500">Best lift</div>
                <div className="text-base text-white">
                  {exMap[summary.bestLift.exId]?.name || summary.bestLift.exId} — {summary.bestLift.weight} × {summary.bestLift.reps}
                </div>
              </div>
            )}
            {summary.prs.length > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-red-500 font-bold">
                <Award size={14} /> {summary.prs.length} PR{summary.prs.length > 1 ? "s" : ""} this session
              </div>
            )}

            {summary.coachMessage && (
              <div className="border-t border-neutral-900 pt-3">
                <div className="text-[10px] uppercase tracking-widest text-red-600 mb-1 flex items-center gap-1.5">
                  <MessageCircle size={11} /> Coach
                </div>
                <div className="text-sm text-neutral-300 whitespace-pre-line">{summary.coachMessage}</div>
                {onAskCoach && (
                  <button onClick={onAskCoach} className="mt-2 text-[11px] uppercase tracking-widest text-red-500 hover:text-red-400">
                    Ask Coach →
                  </button>
                )}
              </div>
            )}

            <div>
              <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1.5">Rate this session</div>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => onRate(summary.id, n)} className="p-0.5">
                    <Star size={20} className={n <= (summary.rating || 0) ? "text-red-500 fill-red-500" : "text-neutral-700"} />
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-neutral-900 pt-3">
              <ShareCardButton buildDataUrl={() => buildWorkoutShareCard(summary)} filename="brk-lift-session.png" />
            </div>
          </div>
        )}

        {run.sessionEntries.length > 0 ? (
          <div className="space-y-1.5">
            {run.sessionEntries.map(({ entry }, i) => (
              <div key={entry.id || i} className="border border-neutral-800 bg-charcoal-panel px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-base text-white">{exMap[entry.exId]?.name || entry.exId}</span>
                  <span className="text-xs text-neutral-500">Target {entry.targetReps}</span>
                </div>
                <div className="text-xs text-neutral-400 mt-1">{entry.sets.map(formatSetCompact).join(", ")}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-neutral-500">Nothing logged this session.</div>
        )}

        <button
          onClick={onExit}
          className="w-full py-3 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600"
        >
          Back to plans
        </button>
      </div>
    );
  }

  const entryForIndex = (idx) => run.sessionEntries.find((se) => se.index === idx)?.entry || null;
  const currentIdx = run.exercises.findIndex((_, idx) => !entryForIndex(idx));

  // Superset/giant-set grouping: exercises carry an optional single-letter `group` (set in
  // Build Plan). Two or more *consecutive* plan entries sharing a letter render as A1/A2/A3
  // and share one rest window — logging a non-last member skips the rest timer entirely so
  // the flow is "log A1 -> log A2 -> rest -> repeat," not a rest after every single movement.
  const groupLabel = (idx) => {
    const g = run.exercises[idx].group;
    if (!g) return null;
    const prevSame = idx > 0 && run.exercises[idx - 1].group === g;
    const nextSame = idx < run.exercises.length - 1 && run.exercises[idx + 1].group === g;
    if (!prevSame && !nextSame) return null;
    let start = idx;
    while (start > 0 && run.exercises[start - 1].group === g) start--;
    return `${g}${idx - start + 1}`;
  };
  const isLastInGroup = (idx) => {
    const g = run.exercises[idx].group;
    if (!g) return true;
    return !(idx < run.exercises.length - 1 && run.exercises[idx + 1].group === g);
  };

  // Pre-workout advice, shown only before anything's been logged — once the session's under
  // way, per-exercise Recommended/Last-time cards already carry that context.
  let preWorkout = null;
  if (run.sessionEntries.length === 0 && run.exercises.length > 0) {
    const leadExId = run.swaps?.[0] ?? run.exercises[0].exId;
    const leadSuggestion = suggestNext(leadExId, state.logs, exMap, { readinessLogs: state.readinessLogs });
    const focus =
      leadSuggestion.suggestion != null
        ? {
            name: exMap[leadExId]?.name || leadExId,
            lastWeight: leadSuggestion.lastWeight,
            lastReps: leadSuggestion.lastReps,
            suggestedWeight: leadSuggestion.suggestion,
            suggestedReps: leadSuggestion.targetReps,
          }
        : null;
    preWorkout = generatePreWorkoutAdvice({ readiness: todayReadinessSummary(state) }, focus);
  }

  const totalExercises = run.exercises.length;
  const loggedCount = run.sessionEntries.length;
  const stepNumber = Math.min(currentIdx === -1 ? totalExercises : currentIdx + 1, totalExercises);
  const progressPct = totalExercises > 0 ? Math.round((loggedCount / totalExercises) * 100) : 0;
  const elapsedSec = Math.max(0, Math.round((nowTick - new Date(run.startedAt).getTime()) / 1000));
  const elapsedLabel = `${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-widest text-red-600 truncate">{run.planName}</div>
            <div className="text-sm text-neutral-400 mt-0.5">
              Exercise {stepNumber} of {totalExercises} · {elapsedLabel}
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-3">
            <button onClick={onExit} className="text-xs text-neutral-600 hover:text-red-600">
              Exit
            </button>
            <button onClick={onFinish} className="text-xs uppercase tracking-widest font-bold text-red-500 hover:text-red-400">
              Finish
            </button>
          </div>
        </div>
        <div className="h-1.5 bg-neutral-900 w-full">
          <div className="h-1.5 bg-red-700 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {preWorkout && (
        <div className="border border-red-900/40 bg-charcoal-panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-red-600 mb-1 flex items-center gap-1.5">
            <MessageCircle size={11} /> Coach
          </div>
          <div className="text-sm text-neutral-300">{preWorkout.message}</div>
        </div>
      )}

      <div className="space-y-8">
        {run.exercises.map((exSlot, idx) => {
          const currentExId = run.swaps?.[idx] ?? exSlot.exId;
          const entry = entryForIndex(idx);
          const isLogged = !!entry;
          const isEditing = editingIdx === idx;
          const isActive = !isLogged && idx === currentIdx;

          const label = groupLabel(idx);

          return (
            <div key={idx} className="border-t border-neutral-900 pt-6 first:border-t-0 first:pt-0">
              {label && (
                <div className="text-[10px] uppercase tracking-widest text-red-600 font-bold mb-1.5">{label}</div>
              )}
              {isEditing ? (
                <EditLogEntryPanel
                  entry={entry}
                  exMap={exMap}
                  rirSystem={rirSystem}
                  simple={isSimple}
                  onBack={() => setEditingIdx(null)}
                  onSave={(changes) => {
                    const updatedEntry = { ...entry, ...changes };
                    updateState((prev) => ({
                      ...prev,
                      logs: prev.logs.map((l) => (l.id === entry.id ? updatedEntry : l)),
                    }));
                    onEditEntry(idx, updatedEntry);
                    setEditingIdx(null);
                  }}
                  onDelete={() => {
                    if (!window.confirm("Delete this logged entry? This can't be undone.")) return;
                    updateState((prev) => ({ ...prev, logs: prev.logs.filter((l) => l.id !== entry.id) }));
                    onDeleteEntry(idx);
                    setEditingIdx(null);
                  }}
                />
              ) : isLogged ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs text-green-500 mb-1">
                        <Check size={14} /> Logged this session
                      </div>
                      <div className="text-xl font-bold text-white truncate">{exMap[currentExId]?.name || currentExId}</div>
                      <div className="space-y-0.5 mt-1.5">
                        {entry.sets.map((s, i) => (
                          <div key={i} className="text-sm text-neutral-400">
                            Set {i + 1}: {formatSetVerbose(s)}
                          </div>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => setEditingIdx(idx)}
                      className="shrink-0 text-xs uppercase tracking-widest text-red-500 hover:text-red-400"
                    >
                      Edit
                    </button>
                  </div>
                  {prByIndex[idx] && <PRCallout exMap={exMap} exId={currentExId} prs={prByIndex[idx]} />}
                </div>
              ) : isActive ? (
                <TrainingExerciseCard
                  key={currentExId}
                  exId={currentExId}
                  exSlot={exSlot}
                  state={state}
                  updateState={updateState}
                  exMap={exMap}
                  allExercises={allExercises}
                  onSaved={(savedEntry) => {
                    const prs = detectPRs(currentExId, savedEntry, state.logs);
                    if (prs.length > 0) setPrByIndex((m) => ({ ...m, [idx]: prs }));
                    onSaved(idx, savedEntry);
                  }}
                  onSwap={(newExId) => onSwap(idx, newExId)}
                  onSetSaved={() => {
                    // Mid-group (e.g. still on A1 of an A1/A2 pair): no rest, straight into the
                    // next movement. Rest only starts once the group's last exercise logs a set,
                    // and uses the "superset" default rather than this one exercise's own
                    // compound/isolation category. Within a solo exercise (or the group's last
                    // member), every individual saved set now bumps rest, not just the whole
                    // exercise at once.
                    if (isLastInGroup(idx)) onLoggedSet?.(label ? "superset" : { exId: currentExId });
                  }}
                />
              ) : (
                <div className="text-base font-medium text-neutral-600">{exMap[currentExId]?.name || currentExId}</div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={onFinish}
        className="w-full py-3 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600"
      >
        Finish workout
      </button>
    </div>
  );
}

// ---------------- EDIT CARDIO ENTRY ----------------
// Same idea as EditLogEntryPanel but for cardio's distance/duration/load/notes shape.
// Edits flow back through state.cardioLogs, so bestCardioStat recomputes automatically.
function EditCardioEntryPanel({ entry, exMap, onBack, onSave, onDelete }) {
  const [distance, setDistance] = useState(entry.distance != null ? String(entry.distance) : "");
  const [distanceUnit, setDistanceUnit] = useState(entry.distanceUnit || "mi");
  const [duration, setDuration] = useState(entry.duration != null ? String(entry.duration) : "");
  const [load, setLoad] = useState(entry.load != null ? String(entry.load) : "");
  const [notes, setNotes] = useState(entry.notes || "");

  const canSave = distance !== "" || duration !== "";

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      distance: distance !== "" ? Number(distance) : null,
      distanceUnit,
      duration: duration !== "" ? Number(duration) : null,
      load: load !== "" ? Number(load) : null,
      notes: notes.trim(),
    });
  };

  return (
    <SlideInPanel
      title={exMap[entry.exId]?.name || entry.exId}
      subtitle={new Date(entry.date).toLocaleDateString()}
      onBack={onBack}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Distance</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              placeholder="0"
              className="flex-1 min-w-0 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-base focus:outline-none focus:border-red-700"
            />
            <select
              value={distanceUnit}
              onChange={(e) => setDistanceUnit(e.target.value)}
              className="bg-charcoal-panel border border-neutral-800 text-neutral-100 px-2 py-2 text-xs focus:outline-none focus:border-red-700"
            >
              <option value="mi">mi</option>
              <option value="yd">yd</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Duration (min)</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="0"
            className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-base focus:outline-none focus:border-red-700"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Load — sled/ruck only (lb)</label>
        <input
          type="number"
          value={load}
          onChange={(e) => setLoad(e.target.value)}
          placeholder="Optional"
          className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-base focus:outline-none focus:border-red-700"
        />
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Notes</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="How it felt, route, weather, etc."
          className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={!canSave}
        className={`w-full py-3 text-xs uppercase tracking-widest font-bold border ${
          canSave
            ? "bg-red-700 border-red-700 text-white hover:bg-red-600"
            : "bg-charcoal-panel border-neutral-800 text-neutral-700 cursor-not-allowed"
        }`}
      >
        Save changes
      </button>
      <button
        onClick={onDelete}
        className="w-full py-3 text-xs uppercase tracking-widest font-bold border border-neutral-800 bg-charcoal-panel text-neutral-400 hover:text-red-500 hover:border-red-900/40 flex items-center justify-center gap-1.5"
      >
        <Trash2 size={14} /> Delete entry
      </button>
    </SlideInPanel>
  );
}

// ---------------- CARDIO TAB ----------------
function CardioTab({ state, updateState, allExercises, exMap, onLoggedSet }) {
  const conditioningExercises = useMemo(
    () => allExercises.filter((ex) => ex.muscle === "Conditioning"),
    [allExercises]
  );

  const [selectedExId, setSelectedExId] = useState(conditioningExercises[0]?.id || "");
  const [distance, setDistance] = useState("");
  const [distanceUnit, setDistanceUnit] = useState("mi");
  const [duration, setDuration] = useState("");
  const [load, setLoad] = useState("");
  const [notes, setNotes] = useState("");
  const [editingEntryId, setEditingEntryId] = useState(null);

  if (conditioningExercises.length === 0) {
    return (
      <div className="text-center py-16 text-neutral-500 text-sm">
        No conditioning exercises in the catalog yet. Add one (muscle group: Conditioning) from the Catalog tab.
      </div>
    );
  }

  const currentExId = selectedExId || conditioningExercises[0].id;
  const currentEx = exMap[currentExId];

  const cardioLogs = state.cardioLogs || [];
  const recentForEx = cardioLogs
    .filter((l) => l.exId === currentExId)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);
  const lastEntry = recentForEx[0];
  const best = bestCardioStat(currentExId, cardioLogs);

  const canSave = distance !== "" || duration !== "";

  const saveEntry = () => {
    if (!canSave) return;
    const entry = {
      id: `cardio_${Date.now()}`,
      exId: currentExId,
      date: new Date().toISOString(),
      distance: distance !== "" ? Number(distance) : null,
      distanceUnit,
      duration: duration !== "" ? Number(duration) : null,
      load: load !== "" ? Number(load) : null,
      notes: notes.trim(),
    };
    updateState((prev) => ({ ...prev, cardioLogs: [entry, ...(prev.cardioLogs || [])], hasSeenOnboarding: true }));
    onLoggedSet?.("conditioning");
    setDistance("");
    setDuration("");
    setLoad("");
    setNotes("");
  };

  if (editingEntryId) {
    const entry = cardioLogs.find((l) => l.id === editingEntryId);
    if (!entry) {
      return (
        <SlideInPanel title="Entry not found" onBack={() => setEditingEntryId(null)}>
          <div className="text-sm text-neutral-500">This entry no longer exists.</div>
        </SlideInPanel>
      );
    }
    return (
      <EditCardioEntryPanel
        entry={entry}
        exMap={exMap}
        onBack={() => setEditingEntryId(null)}
        onSave={(changes) => {
          updateState((prev) => ({
            ...prev,
            cardioLogs: (prev.cardioLogs || []).map((l) => (l.id === editingEntryId ? { ...l, ...changes } : l)),
          }));
          setEditingEntryId(null);
        }}
        onDelete={() => {
          if (!window.confirm("Delete this logged entry? This can't be undone.")) return;
          updateState((prev) => ({ ...prev, cardioLogs: (prev.cardioLogs || []).filter((l) => l.id !== editingEntryId) }));
          setEditingEntryId(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Run / conditioning work</label>
        <select
          value={currentExId}
          onChange={(e) => setSelectedExId(e.target.value)}
          className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2.5 text-sm focus:outline-none focus:border-red-700"
        >
          {conditioningExercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>
      </div>

      {(lastEntry || best) && (
        <div className="border border-red-900/40 bg-charcoal-panel p-4 space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-red-600">Where you stand</div>
          {best && (
            <div className="text-3xl font-bold text-white">
              Best {best.type === "pace" ? "pace" : "distance"}: {best.value}
              {best.type === "pace" ? " /mi" : ""}
            </div>
          )}
          {lastEntry && (
            <div className="text-sm text-neutral-500">
              Last: {new Date(lastEntry.date).toLocaleDateString()} —{" "}
              {lastEntry.distance ? `${lastEntry.distance} ${lastEntry.distanceUnit}` : ""}
              {lastEntry.distance && lastEntry.duration ? ", " : ""}
              {lastEntry.duration ? `${lastEntry.duration} min` : ""}
              {lastEntry.load ? `, ${lastEntry.load} lb load` : ""}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Distance</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              placeholder="0"
              className="flex-1 min-w-0 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-base focus:outline-none focus:border-red-700"
            />
            <select
              value={distanceUnit}
              onChange={(e) => setDistanceUnit(e.target.value)}
              className="bg-charcoal-panel border border-neutral-800 text-neutral-100 px-2 py-2 text-xs focus:outline-none focus:border-red-700"
            >
              <option value="mi">mi</option>
              <option value="yd">yd</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Duration (min)</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="0"
            className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-base focus:outline-none focus:border-red-700"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Load — sled/ruck only (lb)</label>
        <input
          type="number"
          value={load}
          onChange={(e) => setLoad(e.target.value)}
          placeholder="Optional"
          className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-base focus:outline-none focus:border-red-700"
        />
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Notes</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="How it felt, route, weather, etc."
          className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
        />
      </div>

      <button
        onClick={saveEntry}
        disabled={!canSave}
        className={`w-full py-3 text-xs uppercase tracking-widest font-bold border ${
          canSave
            ? "bg-red-700 border-red-700 text-white hover:bg-red-600"
            : "bg-charcoal-panel border-neutral-800 text-neutral-700 cursor-not-allowed"
        }`}
      >
        Save session
      </button>

      {recentForEx.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">History</div>
          <div className="space-y-1.5">
            {recentForEx.map((l) => {
              const pace = cardioPace(l);
              return (
                <button
                  key={l.id}
                  onClick={() => setEditingEntryId(l.id)}
                  className="w-full text-xs border-b border-neutral-900 py-2 text-left hover:border-neutral-700"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">{new Date(l.date).toLocaleDateString()}</span>
                    <span className="text-sm text-neutral-300">
                      {l.distance ? `${l.distance} ${l.distanceUnit}` : ""}
                      {l.distance && l.duration ? " · " : ""}
                      {l.duration ? `${l.duration} min` : ""}
                      {pace ? ` · ${formatPace(pace)} /mi` : ""}
                      {l.load ? ` · ${l.load} lb` : ""}
                    </span>
                  </div>
                  {l.notes && <div className="text-neutral-600 mt-1 text-left">{l.notes}</div>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- TEMPLATES TAB ----------------
function TemplatesTab({ state, updateState, exMap, onStartRun, onRestartCompletedProgram, onGoToBuild }) {
  const [detail, setDetail] = useState(null); // { kind: "program" | "template" | "customPlan" | "customProgram", id }

  const deleteCustomPlan = (id) => updateState((prev) => ({ ...prev, customPlans: prev.customPlans.filter((p) => p.id !== id) }));
  const deleteCustomProgram = (id) =>
    updateState((prev) => ({ ...prev, customPrograms: (prev.customPrograms || []).filter((p) => p.id !== id) }));

  const copyToCustom = (tpl) => {
    const newPlan = { ...tpl, id: `plan_${Date.now()}`, name: `${tpl.name} (copy)`, isCustom: true };
    updateState((prev) => ({ ...prev, customPlans: [...prev.customPlans, newPlan] }));
  };

  const copyDayToCustom = (program, day) => {
    const newPlan = {
      id: `plan_${Date.now()}`,
      name: `${program.name} — ${day.label}`,
      exercises: day.exercises,
      isCustom: true,
    };
    updateState((prev) => ({ ...prev, customPlans: [...prev.customPlans, newPlan] }));
  };

  const copyProgramToCustom = (program) => {
    const newProgram = {
      id: `program_${Date.now()}`,
      name: program.name,
      tagline: program.tagline,
      weeks: program.weeks,
      days: program.days,
      isCustom: true,
    };
    updateState((prev) => ({ ...prev, customPrograms: [...(prev.customPrograms || []), newProgram] }));
  };

  const currentProgramDay = useMemo(() => resolveCurrentProgramDay(state), [state]);
  const isCurrent = (progId) =>
    state.currentProgram?.source === "builtin" && state.currentProgram.programId === progId;
  const isComplete = (progId) => isCurrent(progId) && currentProgramDay?.isComplete;
  const isCurrentCustom = (progId) => state.currentProgram?.source === "custom" && state.currentProgram.programId === progId;
  const isCompleteCustom = (progId) => isCurrentCustom(progId) && currentProgramDay?.isComplete;

  if (detail?.kind === "customPlan") {
    const p = state.customPlans.find((pl) => pl.id === detail.id);
    if (!p) return null;
    return (
      <SlideInPanel title={p.name} subtitle={`${p.exercises.length} exercises`} onBack={() => setDetail(null)}>
        <div className="space-y-1.5">
          {p.exercises.map((e, i) => (
            <div key={i} className="flex items-center justify-between text-xs text-neutral-400 py-1.5 border-t border-neutral-900">
              <span className="text-sm">{exMap[e.exId]?.name || e.exId}{e.group ? ` (${e.group})` : ""}</span>
              <span className="text-neutral-600">
                {e.sets} x {e.reps}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => onStartRun(p)} className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1">
            <ChevronRight size={12} /> Start workout
          </button>
          <button
            onClick={() => {
              if (!window.confirm(`Delete "${p.name}"? This can't be undone.`)) return;
              deleteCustomPlan(p.id);
              setDetail(null);
            }}
            className="text-xs text-neutral-500 hover:text-red-600 flex items-center gap-1"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </SlideInPanel>
    );
  }

  if (detail?.kind === "customProgram") {
    const prog = (state.customPrograms || []).find((pr) => pr.id === detail.id);
    if (!prog) return null;
    return (
      <SlideInPanel
        title={prog.name}
        subtitle={prog.weeks ? `${prog.days.length} days · ${prog.weeks} weeks` : `${prog.days.length} days`}
        onBack={() => setDetail(null)}
      >
        {prog.days.map((day, di) => (
          <div key={di} className="border-t border-neutral-900 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-red-500 flex items-center gap-1.5">
                {day.label}
                {isCurrentCustom(prog.id) && state.currentProgram.dayIndex === di && (
                  <span className="text-[9px] uppercase tracking-widest bg-red-700 text-white px-1.5 py-0.5">Next up</span>
                )}
              </span>
              <button
                onClick={() =>
                  onStartRun(
                    { name: `${prog.name} — ${day.label}`, exercises: day.exercises },
                    { programId: prog.id, programName: prog.name, source: "custom", dayIndex: di, totalDays: prog.days.length }
                  )
                }
                className="text-[11px] text-red-500 hover:text-red-400 flex items-center gap-1"
              >
                <ChevronRight size={11} /> Start workout
              </button>
            </div>
            <div className="space-y-1.5">
              {day.exercises.map((e, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-neutral-400">
                  <span className="text-sm">{exMap[e.exId]?.name || e.exId}</span>
                  <span className="text-neutral-600">
                    {e.sets} x {e.reps}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        <button
          onClick={() => {
            if (!window.confirm(`Delete "${prog.name}"? This can't be undone.`)) return;
            deleteCustomProgram(prog.id);
            setDetail(null);
          }}
          className="text-xs text-neutral-500 hover:text-red-600 flex items-center gap-1"
        >
          <Trash2 size={12} /> Delete program
        </button>
      </SlideInPanel>
    );
  }

  if (detail?.kind === "program") {
    const prog = (state.programs || []).find((p) => p.id === detail.id);
    if (!prog) return null;
    return (
      <SlideInPanel
        title={prog.name}
        subtitle={prog.weeks ? `${prog.tagline} · ${prog.weeks} weeks` : prog.tagline}
        onBack={() => setDetail(null)}
      >
        <button
          onClick={() => copyProgramToCustom(prog)}
          className="w-full py-2 text-xs uppercase tracking-widest font-bold border border-red-700 text-red-500 hover:bg-red-950/30 flex items-center justify-center gap-1.5"
        >
          <Plus size={12} /> Add to my program
        </button>
        {prog.days.map((day, di) => (
          <div key={di} className="border-t border-neutral-900 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-red-500 flex items-center gap-1.5">
                {day.label}
                {isCurrent(prog.id) && state.currentProgram.dayIndex === di && (
                  <span className="text-[9px] uppercase tracking-widest bg-red-700 text-white px-1.5 py-0.5">Next up</span>
                )}
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    onStartRun(
                      { name: `${prog.name} — ${day.label}`, exercises: day.exercises },
                      { programId: prog.id, programName: prog.name, source: "builtin", dayIndex: di, totalDays: prog.days.length }
                    )
                  }
                  className="text-[11px] text-red-500 hover:text-red-400 flex items-center gap-1"
                >
                  <ChevronRight size={11} /> Start workout
                </button>
                <button
                  onClick={() => copyDayToCustom(prog, day)}
                  className="text-[11px] text-neutral-500 hover:text-red-500 flex items-center gap-1"
                >
                  <Plus size={11} /> Copy to my plans
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              {day.exercises.map((e, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-neutral-400">
                  <span className="text-sm">{exMap[e.exId]?.name || e.exId}</span>
                  <span className="text-neutral-600">
                    {e.sets} x {e.reps}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </SlideInPanel>
    );
  }

  if (detail?.kind === "template") {
    const tpl = state.templates.find((t) => t.id === detail.id);
    if (!tpl) return null;
    return (
      <SlideInPanel title={tpl.name} onBack={() => setDetail(null)}>
        <div className="space-y-2">
          {tpl.exercises.map((e, i) => (
            <div key={i} className="flex items-center justify-between text-xs text-neutral-400 py-1.5 border-t border-neutral-900">
              <span className="text-sm">{exMap[e.exId]?.name || e.exId}</span>
              <span className="text-neutral-600">
                {e.sets} x {e.reps}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => onStartRun(tpl)} className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1">
            <ChevronRight size={12} /> Start workout
          </button>
          <button onClick={() => copyToCustom(tpl)} className="text-xs text-neutral-500 hover:text-red-500 flex items-center gap-1">
            <Plus size={12} /> Copy to my plans
          </button>
        </div>
      </SlideInPanel>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-red-600">Plans & programs</div>
          <div className="text-xl font-bold text-white mt-1">Browse everything</div>
        </div>
        {onGoToBuild && (
          <button onClick={onGoToBuild} className="shrink-0 flex items-center gap-1.5 text-xs uppercase tracking-widest text-red-500 hover:text-red-400">
            <Plus size={14} /> Create plan
          </button>
        )}
      </div>

      {state.customPlans.length > 0 && (
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-widest text-red-600">My plans</div>
          <div className="space-y-2">
            {state.customPlans.map((p) => (
              <div key={p.id} className="border border-neutral-800 bg-charcoal-panel px-4 py-3 flex items-center justify-between">
                <button onClick={() => setDetail({ kind: "customPlan", id: p.id })} className="flex-1 min-w-0 text-left">
                  <div className="text-base text-white truncate">{p.name}</div>
                  <div className="text-xs text-neutral-600">{p.exercises.length} exercises</div>
                </button>
                <button
                  onClick={() => onStartRun(p)}
                  className="shrink-0 ml-3 text-[11px] text-red-500 hover:text-red-400 flex items-center gap-1"
                >
                  <ChevronRight size={12} /> Start
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {(state.customPrograms || []).length > 0 && (
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-widest text-red-600">My programs</div>
          <div className="space-y-2">
            {state.customPrograms.map((prog) => (
              <button
                key={prog.id}
                onClick={() => setDetail({ kind: "customProgram", id: prog.id })}
                className="w-full flex items-center justify-between px-4 py-3 border border-neutral-800 bg-charcoal-panel text-left"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium text-white truncate">{prog.name}</span>
                    {isCompleteCustom(prog.id) ? (
                      <span className="text-[9px] uppercase tracking-widest bg-neutral-700 text-white px-1.5 py-0.5 shrink-0">Complete</span>
                    ) : (
                      isCurrentCustom(prog.id) && (
                        <span className="text-[9px] uppercase tracking-widest bg-red-700 text-white px-1.5 py-0.5 shrink-0">Current</span>
                      )
                    )}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5 truncate">
                    {prog.days.length} days{prog.weeks ? ` · ${prog.weeks} weeks` : ""}
                  </div>
                </div>
                <ChevronRight size={16} className="text-neutral-600 shrink-0 ml-2" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="text-[11px] uppercase tracking-widest text-neutral-500">Programs</div>
        <p className="text-xs text-neutral-500">
          Full multi-day splits built around a specific look and training identity. Copy any single day into your
          own plans.
        </p>
        <div className="space-y-2">
          {(state.programs || []).map((prog) => (
            <button
              key={prog.id}
              onClick={() => setDetail({ kind: "program", id: prog.id })}
              className="w-full flex items-center justify-between px-4 py-3 border border-red-900/40 bg-charcoal-panel text-left"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base font-medium text-white truncate">{prog.name}</span>
                  {isComplete(prog.id) ? (
                    <span className="text-[9px] uppercase tracking-widest bg-neutral-700 text-white px-1.5 py-0.5 shrink-0">Complete</span>
                  ) : (
                    isCurrent(prog.id) && (
                      <span className="text-[9px] uppercase tracking-widest bg-red-700 text-white px-1.5 py-0.5 shrink-0">Current</span>
                    )
                  )}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5 truncate">
                  {prog.tagline}
                  {prog.weeks ? ` · ${prog.weeks} weeks` : ""}
                </div>
              </div>
              <ChevronRight size={16} className="text-neutral-600 shrink-0 ml-2" />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-[11px] uppercase tracking-widest text-neutral-500">Single day templates</div>
        <p className="text-xs text-neutral-500">Standard split templates. Copy one into your own plans to customize it.</p>
        <div className="space-y-2">
          {state.templates.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => setDetail({ kind: "template", id: tpl.id })}
              className="w-full flex items-center justify-between px-4 py-3 border border-neutral-800 bg-charcoal-panel text-left"
            >
              <span className="text-base font-medium text-white truncate">{tpl.name}</span>
              <ChevronRight size={16} className="text-neutral-600 shrink-0 ml-2" />
            </button>
          ))}
        </div>
      </div>

      {(state.completedPrograms || []).length > 0 && (
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500">Completed programs</div>
          <p className="text-xs text-neutral-500">Every program you've finished — earned, not reset silently.</p>
          <div className="space-y-2">
            {state.completedPrograms.map((c) => (
              <div key={c.id} className="border border-neutral-800 bg-charcoal-panel px-4 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-base text-white truncate">{c.programName}</div>
                  <div className="text-xs text-neutral-600 mt-0.5">
                    {c.weeks} weeks · {new Date(c.startDate).toLocaleDateString()} – {new Date(c.endDate).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => onRestartCompletedProgram(c.programId, c.programSource)}
                  className="shrink-0 ml-3 text-[11px] text-red-500 hover:text-red-400 flex items-center gap-1"
                >
                  <ChevronRight size={12} /> Restart
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- BUILD PLAN TAB ----------------
function BuildPlanTab({ state, updateState, allExercises, exMap, onStartRun, onGoToPlans }) {
  const [planName, setPlanName] = useState("");
  const [selectedExercises, setSelectedExercises] = useState([]);
  const [exFilter, setExFilter] = useState("");
  const [supersetMode, setSupersetMode] = useState(false);
  const [supersetPicks, setSupersetPicks] = useState([]);
  const [justSaved, setJustSaved] = useState(false);

  const filteredExercises = useMemo(() => {
    const q = exFilter.trim().toLowerCase();
    if (!q) return allExercises;
    return allExercises.filter((ex) => ex.name.toLowerCase().includes(q) || ex.muscle.toLowerCase().includes(q));
  }, [exFilter, allExercises]);

  const addExercise = (exId) => {
    if (selectedExercises.some((e) => e.exId === exId)) return;
    setSelectedExercises((s) => [...s, { exId, sets: 3, reps: 10, group: "" }]);
    setJustSaved(false);
  };
  const removeExercise = (exId) => {
    setSelectedExercises((s) => s.filter((e) => e.exId !== exId));
    setSupersetPicks((p) => p.filter((id) => id !== exId));
  };
  const updateExercise = (exId, field, val) =>
    setSelectedExercises((s) => s.map((e) => (e.exId === exId ? { ...e, [field]: field === "group" ? val : Number(val) } : e)));

  // Simplified superset creation: pick 2+ exercises already added to the plan, tap "Create
  // superset" once, and they're grouped under the next free letter and moved next to each
  // other in the plan order — the raw group-letter text field is gone, but the underlying
  // single-letter `group` field GuidedRunView reads is unchanged.
  const toggleSupersetPick = (exId) =>
    setSupersetPicks((picks) => (picks.includes(exId) ? picks.filter((id) => id !== exId) : [...picks, exId]));
  const createSuperset = () => {
    if (supersetPicks.length < 2) return;
    const used = new Set(selectedExercises.map((e) => e.group).filter(Boolean));
    let letter = "A";
    for (let i = 0; i < 26; i++) {
      const c = String.fromCharCode(65 + i);
      if (!used.has(c)) {
        letter = c;
        break;
      }
    }
    const pickedSet = new Set(supersetPicks);
    const grouped = selectedExercises.filter((e) => pickedSet.has(e.exId)).map((e) => ({ ...e, group: letter }));
    const next = [];
    let inserted = false;
    selectedExercises.forEach((e) => {
      if (pickedSet.has(e.exId)) {
        if (!inserted) {
          next.push(...grouped);
          inserted = true;
        }
      } else {
        next.push(e);
      }
    });
    setSelectedExercises(next);
    setSupersetPicks([]);
    setSupersetMode(false);
  };
  const ungroup = (exId) => updateExercise(exId, "group", "");

  const savePlan = () => {
    if (!planName.trim() || selectedExercises.length === 0) return;
    const plan = { id: `plan_${Date.now()}`, name: planName.trim(), exercises: selectedExercises, isCustom: true };
    updateState((prev) => ({ ...prev, customPlans: [...prev.customPlans, plan] }));
    setPlanName("");
    setSelectedExercises([]);
    setJustSaved(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-red-600">Create plan</div>
          <div className="text-xl font-bold text-white mt-1">Build a workout</div>
        </div>
        {onGoToPlans && (
          <button onClick={onGoToPlans} className="shrink-0 text-xs uppercase tracking-widest text-neutral-500 hover:text-red-500">
            My plans →
          </button>
        )}
      </div>

      {justSaved && (
        <div className="border border-red-900/40 bg-charcoal-panel px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-neutral-300">Plan saved.</div>
          {onGoToPlans && (
            <button onClick={onGoToPlans} className="text-xs uppercase tracking-widest text-red-500 hover:text-red-400 flex items-center gap-1">
              <ChevronRight size={12} /> View my plans
            </button>
          )}
        </div>
      )}

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Plan name</label>
        <input
          type="text"
          value={planName}
          onChange={(e) => setPlanName(e.target.value)}
          placeholder="e.g. Fat loss phase - upper focus"
          className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2.5 text-sm focus:outline-none focus:border-red-700"
        />
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-2">Add exercises</label>
        <input
          type="text"
          value={exFilter}
          onChange={(e) => setExFilter(e.target.value)}
          placeholder="Search the catalog..."
          className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-xs mb-2 focus:outline-none focus:border-red-700"
        />
        <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto border border-neutral-900 p-2">
          {filteredExercises.map((ex) => (
            <button
              key={ex.id}
              onClick={() => addExercise(ex.id)}
              disabled={selectedExercises.some((e) => e.exId === ex.id)}
              className={`text-left text-xs px-2 py-1.5 border ${
                selectedExercises.some((e) => e.exId === ex.id)
                  ? "border-red-800 text-red-600 bg-red-950/30"
                  : "border-neutral-900 text-neutral-400 hover:border-neutral-700"
              }`}
            >
              {ex.name}
            </button>
          ))}
          {filteredExercises.length === 0 && (
            <div className="col-span-2 text-xs text-neutral-600 py-2 text-center">
              No match. Add it in the Catalog tab first.
            </div>
          )}
        </div>
      </div>

      {selectedExercises.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] uppercase tracking-widest text-neutral-500">Plan exercises</label>
            {selectedExercises.length >= 2 && !supersetMode && (
              <button
                onClick={() => setSupersetMode(true)}
                className="text-[11px] uppercase tracking-widest text-red-500 hover:text-red-400"
              >
                Group as superset
              </button>
            )}
          </div>

          {supersetMode && (
            <div className="border border-red-900/40 bg-charcoal-panel p-3 space-y-2">
              <div className="text-xs text-neutral-400">Select 2 or more exercises to superset, then confirm.</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={createSuperset}
                  disabled={supersetPicks.length < 2}
                  className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold border ${
                    supersetPicks.length >= 2
                      ? "bg-red-700 border-red-700 text-white hover:bg-red-600"
                      : "bg-charcoal-panel border-neutral-800 text-neutral-700 cursor-not-allowed"
                  }`}
                >
                  Create superset ({supersetPicks.length})
                </button>
                <button
                  onClick={() => {
                    setSupersetMode(false);
                    setSupersetPicks([]);
                  }}
                  className="px-4 py-2 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-400 hover:border-neutral-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {selectedExercises.map((e) => (
            <div key={e.exId} className="border border-neutral-900 px-3 py-2 space-y-1.5">
              <div className="flex items-center gap-2">
                {supersetMode && (
                  <input
                    type="checkbox"
                    checked={supersetPicks.includes(e.exId)}
                    onChange={() => toggleSupersetPick(e.exId)}
                    className="shrink-0 w-4 h-4 accent-red-700"
                  />
                )}
                <span className="flex-1 min-w-0 text-base text-neutral-200 truncate">{exMap[e.exId]?.name}</span>
                {e.group && !supersetMode && (
                  <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-red-900/40 text-red-400 px-1.5 py-0.5">
                    Superset {e.group}
                    <button onClick={() => ungroup(e.exId)} className="hover:text-white">
                      <X size={10} />
                    </button>
                  </span>
                )}
                {!supersetMode && (
                  <button onClick={() => removeExercise(e.exId)} className="shrink-0 text-neutral-600 hover:text-red-600">
                    <X size={14} />
                  </button>
                )}
              </div>
              {!supersetMode && (
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="number"
                    value={e.sets}
                    onChange={(ev) => updateExercise(e.exId, "sets", ev.target.value)}
                    className="w-14 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-2 py-1 text-xs"
                  />
                  <span className="text-neutral-600 text-xs">sets</span>
                  <input
                    type="number"
                    value={e.reps}
                    onChange={(ev) => updateExercise(e.exId, "reps", ev.target.value)}
                    className="w-14 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-2 py-1 text-xs"
                  />
                  <span className="text-neutral-600 text-xs">reps</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={savePlan}
        disabled={!planName.trim() || selectedExercises.length === 0}
        className={`w-full py-3 text-xs uppercase tracking-widest font-bold border ${
          planName.trim() && selectedExercises.length > 0
            ? "bg-red-700 border-red-700 text-white hover:bg-red-600"
            : "bg-charcoal-panel border-neutral-800 text-neutral-700 cursor-not-allowed"
        }`}
      >
        Save plan
      </button>
    </div>
  );
}

// ---------------- TOP USED TAB ----------------
function TopUsedTab({ state, exMap }) {
  const counts = usageCounts(state.logs);
  const ranked = Object.entries(counts)
    .map(([exId, count]) => ({ ex: exMap[exId], count }))
    .filter((r) => r.ex)
    .sort((a, b) => b.count - a.count);

  if (ranked.length === 0) {
    return (
      <div className="text-center py-16 text-neutral-500 text-sm">
        No sessions logged yet. Log a workout and this tab tracks what you actually train most.
      </div>
    );
  }

  const max = ranked[0].count;

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">Ranked by how often you've logged each lift.</p>
      {ranked.map((r, i) => (
        <div key={r.ex.id} className="border border-neutral-800 bg-charcoal-panel px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {i === 0 && <Star size={12} className="text-red-600" />}
              <span className="text-base text-white">{r.ex.name}</span>
            </div>
            <span className="text-xs text-neutral-500">{r.count}x</span>
          </div>
          <div className="h-1 bg-neutral-900">
            <div className="h-1 bg-red-700" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------- CATALOG TAB ----------------
function CatalogTab({ state, updateState, allExercises }) {
  const [query, setQuery] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("All");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMuscle, setNewMuscle] = useState(MUSCLE_GROUPS[0]);
  const [newType, setNewType] = useState("isolation");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allExercises.filter((ex) => {
      const matchesQuery = !q || ex.name.toLowerCase().includes(q);
      const matchesMuscle = muscleFilter === "All" || ex.muscle === muscleFilter;
      return matchesQuery && matchesMuscle;
    });
  }, [query, muscleFilter, allExercises]);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach((ex) => {
      if (!groups[ex.muscle]) groups[ex.muscle] = [];
      groups[ex.muscle].push(ex);
    });
    return groups;
  }, [filtered]);

  const addCustomExercise = () => {
    if (!newName.trim()) return;
    const id = `custom_${newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now()}`;
    const exercise = { id, name: newName.trim(), muscle: newMuscle, type: newType, custom: true };
    updateState((prev) => ({ ...prev, customExercises: [...(prev.customExercises || []), exercise] }));
    setNewName("");
    setShowAddForm(false);
  };

  const removeCustomExercise = (id) => {
    updateState((prev) => ({ ...prev, customExercises: (prev.customExercises || []).filter((e) => e.id !== id) }));
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">
        Every movement and machine in the library. Can't find something you use — add it once and it shows up
        everywhere you pick an exercise.
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises..."
          className="flex-1 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
        />
        <select
          value={muscleFilter}
          onChange={(e) => setMuscleFilter(e.target.value)}
          className="bg-charcoal-panel border border-neutral-800 text-neutral-100 px-2 py-2 text-xs focus:outline-none focus:border-red-700"
        >
          <option value="All">All</option>
          {MUSCLE_GROUPS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full py-2.5 text-xs uppercase tracking-widest font-bold border border-red-700 text-red-500 hover:bg-red-950/30 flex items-center justify-center gap-1.5"
        >
          <Plus size={14} /> Add missing exercise
        </button>
      ) : (
        <div className="border border-red-900/40 bg-charcoal-panel p-4 space-y-3">
          <div className="text-[11px] uppercase tracking-widest text-red-600">Add exercise</div>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Plate-loaded chest press machine"
            className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
          />
          <div className="flex gap-2">
            <select
              value={newMuscle}
              onChange={(e) => setNewMuscle(e.target.value)}
              className="flex-1 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-2 py-2 text-xs focus:outline-none focus:border-red-700"
            >
              {MUSCLE_GROUPS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="flex-1 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-2 py-2 text-xs focus:outline-none focus:border-red-700"
            >
              <option value="compound">Compound</option>
              <option value="isolation">Isolation</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={addCustomExercise}
              disabled={!newName.trim()}
              className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold border flex items-center justify-center gap-1.5 ${
                newName.trim()
                  ? "bg-red-700 border-red-700 text-white hover:bg-red-600"
                  : "bg-charcoal-panel border-neutral-800 text-neutral-700 cursor-not-allowed"
              }`}
            >
              <Check size={14} /> Save
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewName("");
              }}
              className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-500 hover:text-neutral-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {Object.entries(grouped).map(([muscle, exs]) => (
          <div key={muscle}>
            <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">{muscle}</div>
            <div className="space-y-1.5">
              {exs.map((ex) => (
                <div
                  key={ex.id}
                  className="flex items-center justify-between text-sm border border-neutral-900 bg-charcoal-panel px-3 py-2"
                >
                  <span className="text-base text-neutral-200">{ex.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-600">{ex.type}</span>
                    {ex.custom && (
                      <button onClick={() => removeCustomExercise(ex.id)} className="text-neutral-600 hover:text-red-600">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-neutral-600 text-sm">No matches — add it above.</div>
        )}
      </div>
    </div>
  );
}

// ---------------- PHOTOS ----------------
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load image"));
    img.src = src;
  });
}

const PROGRESS_PHOTO_MAX_DIM = 1080;
const PROGRESS_PHOTO_QUALITY = 0.7;

// Resizes to a max dimension, then burns the BREAK_LOGO watermark and a date/context
// caption directly into the pixel data (not a CSS overlay) so the branding survives
// wherever the photo gets shared, and compresses to JPEG to keep localStorage usage sane.
async function compositeProgressPhoto(file, contextLine) {
  const objectUrl = URL.createObjectURL(file);
  let img;
  try {
    img = await loadImage(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  const scale = Math.min(1, PROGRESS_PHOTO_MAX_DIM / Math.max(img.width, img.height));
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);

  const dateStr = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const lines = contextLine ? [contextLine, dateStr] : [dateStr];

  const padding = Math.round(width * 0.035);
  const fontSize = Math.max(13, Math.round(width * 0.034));
  const lineHeight = Math.round(fontSize * 1.35);
  const logoSize = Math.round(width * 0.13);
  const barHeight = Math.max(lines.length * lineHeight + padding * 1.5, logoSize + padding * 2);

  const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.68)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, height - barHeight, width, barHeight);

  // Watermark logo, bottom-right, clipped to a circle with a red ring
  try {
    const logo = await loadImage(BREAK_LOGO);
    const logoX = width - padding - logoSize;
    const logoY = height - padding - logoSize;
    ctx.save();
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
    ctx.restore();
    ctx.strokeStyle = "rgba(220,38,38,0.9)";
    ctx.lineWidth = Math.max(1, logoSize * 0.045);
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.stroke();
  } catch (e) {
    // logo failed to load — still burn the text caption below
  }

  // Date + context caption, bottom-left
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "bottom";
  let ty = height - padding;
  for (let i = lines.length - 1; i >= 0; i--) {
    const isPrimary = i === 0 && lines.length > 1;
    ctx.font = `${isPrimary ? "bold " : ""}${Math.round(isPrimary ? fontSize : fontSize * 0.82)}px sans-serif`;
    ctx.fillText(lines[i], padding, ty);
    ty -= lineHeight;
  }

  return canvas.toDataURL("image/jpeg", PROGRESS_PHOTO_QUALITY);
}

function PhotoFullView({ photo, onBack, onDelete }) {
  const [shareSupported, setShareSupported] = useState(false);

  useEffect(() => {
    setShareSupported(typeof navigator.share === "function");
  }, []);

  const handleShare = async () => {
    try {
      const res = await fetch(photo.dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `brk-lift-${photo.date.slice(0, 10)}.jpg`, { type: "image/jpeg" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "BRK - Lift progress photo" });
      } else {
        await navigator.share({ title: "BRK - Lift progress photo", text: photo.context || "" });
      }
    } catch (e) {
      // user cancelled the share sheet, or sharing failed — nothing to do
    }
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = photo.dataUrl;
    a.download = `brk-lift-${photo.date.slice(0, 10)}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <SlideInPanel title="Progress photo" subtitle={new Date(photo.date).toLocaleString()} onBack={onBack}>
      <img src={photo.dataUrl} alt="Progress" className="w-full border border-neutral-800" />
      {photo.context && <div className="text-xs text-neutral-500">{photo.context}</div>}
      <div className="flex items-center gap-2">
        {shareSupported ? (
          <button
            onClick={handleShare}
            className="flex-1 py-3 text-xs uppercase tracking-widest font-bold border border-red-700 bg-red-700 text-white hover:bg-red-600 flex items-center justify-center gap-1.5"
          >
            <Share2 size={14} /> Share
          </button>
        ) : (
          <button
            onClick={handleDownload}
            className="flex-1 py-3 text-xs uppercase tracking-widest font-bold border border-red-700 bg-red-700 text-white hover:bg-red-600 flex items-center justify-center gap-1.5"
          >
            <Download size={14} /> Download
          </button>
        )}
        <button
          onClick={onDelete}
          className="py-3 px-4 text-xs uppercase tracking-widest font-bold border border-neutral-800 bg-charcoal-panel text-neutral-300 hover:border-neutral-600 flex items-center justify-center gap-1.5"
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </SlideInPanel>
  );
}

// ---------------- PHOTOS TAB ----------------
function PhotosTab({ state, updateState }) {
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [viewingId, setViewingId] = useState(null);

  const currentProgramDay = useMemo(() => resolveCurrentProgramDay(state), [state]);
  const photos = state.photos || [];

  const handleTakePhoto = () => {
    setErrorMsg(null);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const contextLine =
        currentProgramDay && !currentProgramDay.isComplete
          ? `${currentProgramDay.programName} — ${currentProgramDay.dayLabel}`
          : null;
      const dataUrl = await compositeProgressPhoto(file, contextLine);
      const photo = { id: `photo_${Date.now()}`, date: new Date().toISOString(), context: contextLine, dataUrl };
      let quotaError = false;
      updateState((prev) => {
        const next = { ...prev, photos: [photo, ...(prev.photos || [])] };
        try {
          window.localStorage.setItem("liftlog-data", JSON.stringify(next));
        } catch (err) {
          quotaError = true;
          return prev;
        }
        return next;
      });
      if (quotaError) {
        setErrorMsg("Couldn't save that photo — you're out of local storage space. Delete some older photos and try again.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Couldn't process that photo. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const deletePhoto = (id) => {
    updateState((prev) => ({ ...prev, photos: (prev.photos || []).filter((p) => p.id !== id) }));
    setViewingId(null);
  };

  if (viewingId) {
    const photo = photos.find((p) => p.id === viewingId);
    if (!photo) return null;
    return <PhotoFullView photo={photo} onBack={() => setViewingId(null)} onDelete={() => deletePhoto(photo.id)} />;
  }

  return (
    <div className="space-y-6">
      <button
        onClick={handleTakePhoto}
        disabled={busy}
        className="w-full py-3 text-xs uppercase tracking-widest font-bold border border-red-700 bg-red-700 text-white hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        <Camera size={16} /> {busy ? "Processing..." : "Take progress photo"}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelected}
        className="hidden"
      />
      {errorMsg && <div className="text-xs text-red-500">{errorMsg}</div>}

      {photos.length === 0 ? (
        <div className="text-center py-16 text-neutral-500 text-sm">
          No progress photos yet. Take one to start tracking visually over time.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((p) => (
            <button
              key={p.id}
              onClick={() => setViewingId(p.id)}
              className="aspect-square overflow-hidden border border-neutral-800 bg-charcoal-panel"
            >
              <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- SETTINGS TAB ----------------
// The only backup mechanism available, since everything lives in localStorage with no
// server. Export/import cover every piece of user-created data — logs, cardio logs,
// custom exercises, custom plans and programs, and which program is currently active —
// not just workout logs.
function SettingsTab({ state, updateState }) {
  const fileInputRef = useRef(null);
  const [importMessage, setImportMessage] = useState(null); // { type: "error" | "success", text }

  const handleExport = () => {
    exportBackupFile(state);
    setImportMessage({ type: "success", text: "Backup downloaded." });
  };

  const handleImportClick = () => {
    setImportMessage(null);
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = parseBackupFile(String(reader.result));
      if (!result.ok) {
        setImportMessage({ type: "error", text: result.error });
        return;
      }
      const confirmed = window.confirm(
        "Importing this backup will overwrite all current data on this device — logs, cardio logs, custom exercises, custom plans and programs, and your active program. This can't be undone. Continue?"
      );
      if (!confirmed) return;

      updateState((prev) => {
        const next = { ...prev };
        BACKUP_DATA_KEYS.forEach((key) => {
          if (key in result.data) next[key] = result.data[key];
        });
        return next;
      });
      setImportMessage({ type: "success", text: "Backup restored." });
    };
    reader.onerror = () => setImportMessage({ type: "error", text: "Couldn't read that file." });
    reader.readAsText(file);
  };

  const counts = {
    logs: (state.logs || []).length,
    cardioLogs: (state.cardioLogs || []).length,
    customExercises: (state.customExercises || []).length,
    customPlans: (state.customPlans || []).length,
    customPrograms: (state.customPrograms || []).length,
    photos: (state.photos || []).length,
    completedPrograms: (state.completedPrograms || []).length,
    goals: (state.goals || []).length,
    bodyweightLogs: (state.bodyweightLogs || []).length,
  };

  const settings = state.settings || { rirSystem: "rir", restDefaults: DEFAULT_REST_DEFAULTS, barWeight: 45 };
  const updateSettings = (patch) => updateState((prev) => ({ ...prev, settings: { ...(prev.settings || {}), ...patch } }));
  const updateRestDefault = (category, val) =>
    updateSettings({ restDefaults: { ...(settings.restDefaults || DEFAULT_REST_DEFAULTS), [category]: Number(val) || 0 } });

  return (
    <div className="space-y-6">
      <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-4">
        <div className="text-[11px] uppercase tracking-widest text-red-600">Training</div>

        <div>
          <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Effort tracking</label>
          <div className="flex gap-2">
            <button
              onClick={() => updateSettings({ rirSystem: "rir" })}
              className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold border ${
                settings.rirSystem !== "rpe" ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400 hover:border-neutral-600"
              }`}
            >
              RIR
            </button>
            <button
              onClick={() => updateSettings({ rirSystem: "rpe" })}
              className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold border ${
                settings.rirSystem === "rpe" ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400 hover:border-neutral-600"
              }`}
            >
              RPE
            </button>
          </div>
          <p className="text-xs text-neutral-600 mt-1.5">Reps in reserve (0–5+) or rate of perceived exertion (6–10), logged per set.</p>
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Rest timer defaults (seconds)</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["compound", "Compound"],
              ["isolation", "Isolation"],
              ["conditioning", "Conditioning"],
              ["superset", "Superset"],
            ].map(([key, label]) => (
              <div key={key}>
                <div className="text-[10px] text-neutral-600 mb-1">{label}</div>
                <input
                  type="number"
                  value={(settings.restDefaults || DEFAULT_REST_DEFAULTS)[key]}
                  onChange={(e) => updateRestDefault(key, e.target.value)}
                  className="w-full bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Barbell weight</label>
          <div className="flex gap-2 items-center">
            {[45, 35].map((w) => (
              <button
                key={w}
                onClick={() => updateSettings({ barWeight: w })}
                className={`px-4 py-2 text-xs font-bold border ${
                  settings.barWeight === w ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400 hover:border-neutral-600"
                }`}
              >
                {w} lb
              </button>
            ))}
            <input
              type="number"
              value={settings.barWeight}
              onChange={(e) => updateSettings({ barWeight: Number(e.target.value) || 0 })}
              placeholder="Custom"
              className="w-24 bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
            />
          </div>
        </div>
      </div>

      <div className="border border-red-900/40 bg-charcoal-panel p-4 space-y-4">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-red-600">Data backup</div>
          <p className="text-xs text-neutral-500 mt-1">
            Everything is stored on this device only — there's no account or server. Export a backup before
            switching phones or clearing browser data, and import it to restore.
          </p>
        </div>

        <div className="text-xs text-neutral-400 space-y-1">
          <div>{counts.logs} lift logs</div>
          <div>{counts.cardioLogs} run / conditioning logs</div>
          <div>{counts.customExercises} custom exercises</div>
          <div>{counts.customPlans} custom plans</div>
          <div>{counts.customPrograms} custom programs</div>
          <div>{counts.photos} progress photos</div>
          <div>{counts.completedPrograms} completed programs</div>
          <div>{counts.goals} goals</div>
          <div>{counts.bodyweightLogs} bodyweight entries</div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleExport}
            className="flex-1 py-3 text-xs uppercase tracking-widest font-bold border border-red-700 bg-red-700 text-white hover:bg-red-600 flex items-center justify-center gap-1.5"
          >
            <Download size={14} /> Export data
          </button>
          <button
            onClick={handleImportClick}
            className="flex-1 py-3 text-xs uppercase tracking-widest font-bold border border-neutral-800 bg-charcoal-panel text-neutral-200 hover:border-neutral-600 flex items-center justify-center gap-1.5"
          >
            <Upload size={14} /> Import data
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileSelected}
            className="hidden"
          />
        </div>

        {importMessage && (
          <div className={`text-xs ${importMessage.type === "error" ? "text-red-500" : "text-green-500"}`}>
            {importMessage.text}
          </div>
        )}
      </div>
    </div>
  );
}
