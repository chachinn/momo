from pathlib import Path

p = Path('styles.css')
text = p.read_text()
marker = '/* Variable monthly card: the monthly amount is the statement-cycle amount. */'
if marker not in text:
    text += '''\n\n/* Variable monthly card: the monthly amount is the statement-cycle amount. */\n#payableStatementBalanceField[hidden],\n#payableMinimumDueField[hidden] {\n  display: none !important;\n}\n'''
p.write_text(text)
